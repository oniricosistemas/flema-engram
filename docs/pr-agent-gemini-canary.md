# PR-Agent Gemini canary

This disposable documentation-only change exists to validate the advisory PR-Agent workflow against a same-repository pull request.

The canary must remain unmerged. Its only acceptance signal is an Actions run that safely snapshots the immutable diff, invokes the configured primary Gemini provider, and either publishes a valid advisory review or reports a bounded fail-closed outcome without exposing provider diagnostics or credentials.
