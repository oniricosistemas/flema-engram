import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const source = readFileSync('.github/workflows/pr-agent.yml', 'utf8');
type Step = { id?: string; run?: string; if?: string; env?: Record<string, string>; 'continue-on-error'?: boolean };
function steps(): Step[] { return parse(source).jobs['advisory-review'].steps; }
function scripts(): string[] {
  return steps().flatMap(step => [...(step.run ?? '').matchAll(/<<'PY'\n([\s\S]*?)\nPY(?:\n|$)/g)].map(match => match[1]!));
}
function script(marker: string): string {
  const found = scripts().find(text => text.includes(marker));
  expect(found, marker).toBeDefined();
  return found!;
}
function python(code: string) {
  return spawnSync('python3', ['-B', '-'], { input: code, encoding: 'utf8', timeout: 10_000,
    env: { PATH: process.env.PATH, PROVIDER_SECRET: 'offline-fixture', GH_TOKEN: 'must-remove', GITHUB_TOKEN: 'must-remove' } });
}
function successful(result: ReturnType<typeof python>) {
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
}
// JSON string literals are valid Python strings for the embedded source used here.
const literal = (value: unknown) => JSON.stringify(value);
const providerIds = ['g1', 'g2', 'ollama', 'openrouter'];

describe('PR-Agent offline workflow contract', () => {
  it('rejects control bytes and parses the entire YAML', () => {
    expect(source).not.toMatch(/[\x00-\x08\x0b-\x1f\x7f]/);
    expect(steps().length).toBe(9);
    expect(source).toContain('.replace("\\r\\n", "\\n").replace("\\r", "\\n")');
  });

  it('enumerates all eight Python heredocs and syntax-checks every shell run', () => {
    expect(scripts()).toHaveLength(8);
    for (const code of scripts()) successful(python(`compile(${literal(code)}, '<workflow>', 'exec')`));
    for (const step of steps().filter(step => step.run)) {
      const result = spawnSync('bash', ['-n'], { input: step.run, encoding: 'utf8' });
      expect(result.status, result.stderr).toBe(0);
    }
    const provider = steps().find(step => step.id === 'prepare')!.run!.match(/<<'SH'\n([\s\S]*?)\nSH/)!;
    expect(provider).not.toBeNull();
    const result = spawnSync('bash', ['-n'], { input: provider[1], encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
  });

  it('preserves ordered transient-only gates and explicit final failure', () => {
    const routes = steps().filter(step => providerIds.includes(step.id ?? ''));
    expect(routes.map(step => step.id)).toEqual(providerIds);
    expect(routes[0]!.if).toBeUndefined();
    ['g1', 'g2', 'ollama'].forEach((predecessor, index) => {
      expect(routes[index + 1]!.if).toBe(`steps.${predecessor}.outputs.outcome == 'TRANSIENT'`);
    });
    expect(routes.every(step => step['continue-on-error'] === true)).toBe(true);
    expect(steps().filter(step => step['continue-on-error']).length).toBe(4);
    expect(source).toContain('if [[ $route == OPENROUTER ]]; then finish EXHAUSTED');
    expect(source).toContain('finish CONTRACT invalid-output 1');
    expect(source).toContain('finish PERMANENT missing-credential 1');
    expect(steps().find(step => step.run === 'exit 1')!.if).toBe("steps.check_review.outputs.any_valid != 'true'");
    expect(parse(source).jobs['advisory-review'].if).toContain("github.event.action == 'labeled'");
    expect(source).toContain('github.event.label.name == \'pr-agent-review\'');
    expect(source).toContain('pragent/pr-agent@sha256:162427075a59d581c9dbb6fe856864bdd564ce2580433b6122deed0ed9b59a17');
  });

  it.each([
    ['success', 'import os; print("stdout"); os.write(2,b"stderr\\n"); assert "GH_TOKEN" not in os.environ; assert "GITHUB_TOKEN" not in os.environ; assert "PROVIDER_SECRET" not in os.environ; assert os.environ["FIXTURE_KEY"] == "offline-fixture"', 0, false],
    ['nonzero', 'import sys; print("stdout"); sys.stderr.write("stderr\\n"); sys.exit(7)', 7, false],
    ['timeout', 'import time; time.sleep(3)', 124, true],
    ['closed-stdout timeout', 'import os, time; os.close(1); time.sleep(3)', 124, true],
    ['cap', 'import os; os.write(1,b"x"*60000)', 65, false],
  ])('captures local child %s without provider execution', (_name, child, status, timeout) => {
    successful(python(`
import builtins, io, os, sys
files = {}
class Capture(io.FileIO):
    def __init__(self): super().__init__(os.memfd_create('pr-agent-offline'), 'w+')
    def close(self): pass
    def getvalue(self):
        self.seek(0)
        return self.read()
def fake_open(path, mode, **kwargs):
    files[path] = io.StringIO() if 'b' not in mode else Capture()
    return files[path]
builtins.open = fake_open
sys.argv = ['capture', 'FIXTURE_KEY', 'stdout', 'stderr', 'marker', '0.3', sys.executable, '-c', ${literal(child)}]
try:
    exec(${literal(script('MAX_OUTPUT_BYTES'))})
except SystemExit as error:
    assert error.code == ${status}, error.code
assert ('marker' in files) == ${timeout ? 'True' : 'False'}
assert len(files['stdout'].getvalue()) <= 50000
${status === 0 || status === 7 ? "assert files['stdout'].getvalue() == b'stdout\\n'\nassert files['stderr'].getvalue() == b'stderr\\n'" : ''}
${status === 65 ? "assert b'exceeded' in files['stderr'].getvalue()" : ''}
`));
  });

  it.each([
    [1, 'HTTP 429', false, 'TRANSIENT\tallowlisted-transient'],
    [1, 'HTTP 503', false, 'TRANSIENT\tallowlisted-transient'],
    [1, 'Traceback (most recent call last):\nHTTP 429', false, 'TRANSIENT\tallowlisted-transient'],
    [1, 'HTTP 401\nHTTP 429', false, 'PERMANENT\tnon-retryable'],
    [1, 'HTTP 429\nunrecognized', false, 'PERMANENT\tunknown-failure'],
    [1, '', false, 'PERMANENT\tunknown-failure'],
    [1, 'Traceback (most recent call last):', false, 'PERMANENT\tunknown-failure'],
    [1, 'connection refused', false, 'TRANSIENT\tallowlisted-transient'],
    [124, 'HTTP 429', false, 'PERMANENT\tchild-signal-or-124'],
    [143, 'HTTP 429', false, 'PERMANENT\tchild-signal-or-124'],
    [124, '', true, 'TRANSIENT\twrapper-timeout'],
  ])('classifies status=%s diagnostics=%s timeout=%s', (status, text, timeout, outcome) => {
    const result = python(`import pathlib, sys
pathlib.Path.read_text = lambda *args, **kwargs: ${literal(text)}
pathlib.Path.exists = lambda *args: ${timeout ? 'True' : 'False'}
sys.argv = ['classifier', '${status}', 'stderr', 'marker']
exec(${literal(script('permanent ='))})`);
    successful(result);
    expect(result.stdout.trim()).toBe(outcome);
  });

  it.each(['post', 'patch', 'port', 'origin', 'credentials', 'fragment', 'path', 'loop', 'cap', 'head', 'base', 'diff', 'identity', 'review', 'changed-head', 'changed-base'])('publisher enforces %s with mocked HTTP and files', scenario => {
    successful(python(`
import builtins, hashlib, io, json, os, sys, urllib.request
scenario = ${literal(scenario)}
head, base = 'a'*40, 'b'*40
review_fixture = b'Offline advisory finding'
diff = b'diff --git a/a b/a\\n+fixture'
digest = hashlib.sha256(diff).hexdigest()
identity = dict(head_sha=head, base_sha=base, diff_sha256=digest, review_sha256=hashlib.sha256(review_fixture).hexdigest())
if scenario == 'identity': identity['head_sha'] = 'c'*40
if scenario == 'review': identity['review_sha256'] = '0'*64
def fake_open(path, mode='r', **kwargs):
    data = json.dumps(identity).encode() if path == 'identity' else review_fixture
    return io.BytesIO(data) if 'b' in mode else io.StringIO(data.decode())
builtins.open = fake_open
os.path.isfile = lambda path: True
os.path.islink = lambda path: False
os.environ['IDENTITY_PATH'] = 'identity'
os.environ['GITHUB_TOKEN'] = 'offline-only'
sys.argv = ['publisher', 'https://api.example:443', 'owner/repo', '23', head, base, digest, 'review']
calls, writes = [], []
class Response(io.BytesIO):
    def __init__(self, data, headers=None):
        super().__init__(data); self.headers = headers or {}
def respond(request, timeout):
    url, method = request.full_url, request.get_method()
    calls.append(url)
    if method != 'GET':
        writes.append((url, method, json.loads(request.data)))
        return Response(b'{}')
    if '/pulls/' in url:
        count = sum('/pulls/' in call for call in calls)
        return Response(json.dumps(dict(head=dict(sha='c'*40 if scenario == 'head' or (scenario == 'changed-head' and count > 1) else head), base=dict(sha='c'*40 if scenario == 'base' or (scenario == 'changed-base' and count > 1) else base, repo=dict(id=99)))).encode())
    if '/compare/' in url:
        return Response(diff + b'changed' if scenario == 'diff' else diff + b'\\r\\n')
    page = sum('/comments?' in call for call in calls)
    next_url = 'https://api.example:443/repositories/99/issues/23/comments?page=2'
    replacements = dict(port='https://api.example:444/repos/owner/repo/issues/23/comments?page=2', origin='https://foreign.example:443/repos/owner/repo/issues/23/comments?page=2', credentials='https://user@api.example:443/repos/owner/repo/issues/23/comments?page=2', fragment=next_url+'#bad', path='https://api.example:443/foreign?page=2', loop=url)
    next_url = replacements.get(scenario, next_url)
    if scenario == 'cap': next_url = f'https://api.example:443/repos/owner/repo/issues/23/comments?page={page+1}'
    headers = {'Link': f'<{next_url}>; rel="next"'} if page == 1 or scenario == 'cap' else {}
    comments = [dict(id=8, body='<!-- pr-agent-advisory-review --> old')] if scenario == 'patch' else []
    return Response(json.dumps(comments).encode(), headers)
urllib.request.urlopen = respond
rejected = False
try: exec(${literal(script('MAX_REVIEW_BYTES'))})
except (AssertionError, RuntimeError, ValueError): rejected = True
if scenario in ('post', 'patch'):
    assert not rejected
    assert len(writes) == 1
    assert writes[0][1] == ('POST' if scenario == 'post' else 'PATCH')
    assert writes[0][0].endswith('/issues/23/comments' if scenario == 'post' else '/issues/comments/8')
    assert head in writes[0][2]['body'] and digest in writes[0][2]['body']
    assert sum('/pulls/' in call for call in calls) == 2
else:
    assert rejected, scenario
    assert not writes, writes
`));
  });
});
