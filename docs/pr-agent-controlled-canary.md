# Controlled PR-Agent failover canary

This maintainer-only workflow dispatch proves that PR-Agent's production route gates advance from G1 to G2 without changing repository secrets or weakening terminal safety classifications.

## Authorization boundary

GitHub permits only users with repository write access to dispatch a workflow. The job adds two stricter checks:

- the workflow must run from `refs/heads/main`;
- the `confirm` input must equal `RUN_CONTROLLED_FAILOVER`.

The dispatched PR number is treated only as an identifier. The workflow fetches the live PR through GitHub's API and accepts it only when it is open, targets `main`, and both its head and base repositories equal the current repository. The workflow then freezes and hashes the live diff exactly as the advisory path does.

Pull-request content, labels, branches, and changed files cannot enable controlled-canary mode. The mode is derived from the trusted `workflow_dispatch` event and is applied only to G1.

## Run the canary

1. Open a disposable same-repository PR with a small non-sensitive diff targeting `main`.
2. Dispatch the workflow from `main`:

   ```sh
   gh workflow run pr-agent.yml \
     --repo oniricosistemas/flema-engram \
     --ref main \
     -f pr_number=<PR_NUMBER> \
     -f confirm=RUN_CONTROLLED_FAILOVER
   ```

3. Inspect only the sanitized route summary. A successful canary records:

   ```text
   canary route=G1 outcome=PERMANENT reason=controlled-canary advance=true
   canary route=G2 outcome=<OUTCOME> reason=<REASON> attempted=true
   ```

G1 does not invoke a provider and does not receive the production Gemini key. G2 and any naturally reached later routes use their normal isolated provider credentials and production classifier.

## Safety and publication

The synthetic G1 result uses the production `route_decision` function and the production G2 gate. It does not create a review artifact. Dispatch runs cannot execute either the advisory failure step or the publication step, even if a later provider returns a valid review.

Contract, artifact-integrity, candidate-authority, signal, resource-boundary, and diagnostic-safety failures retain their normal terminal behavior. The canary does not reclassify `invalid-diagnostics` or any other terminal result.

The final validation step verifies G1 advancement and a non-empty G2 outcome, emits only bounded identifiers, and removes the run's temporary state on success or failure.

## Cleanup

Close the disposable PR without merging and delete its branch. Do not rotate, remove, or replace provider secrets for canary execution.
