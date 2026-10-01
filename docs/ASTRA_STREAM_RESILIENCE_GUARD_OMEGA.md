# ASTRA STREAM RESILIENCE GUARD Ω

Reusable rule for BetGPT and future ASTRA projects.

## Goal

A transient stream/cache/network failure must never erase already completed work or force the whole workflow to start again.

The guard does **not** pretend an upstream service can never fail. It makes those failures recoverable.

## Mandatory contract

1. Split long operations into stable, named steps.
2. Persist an atomic checkpoint after every successful step.
3. On restart, reuse only checkpoints matching the same workflow key, version, and step fingerprint.
4. Retry only errors classified as transient (including `Stream cache expired`, connection resets and timeouts).
5. Use bounded timeouts and exponential backoff.
6. Never retry a business-logic/data-integrity failure as if it were a network glitch.
7. Every side-effecting step must be idempotent for the same workflow key.
8. Never report PASS when a step is missing or unverified.

## Status semantics

- **PASS** — completed without recovery.
- **RESUMED** — recovered from a transient failure or durable checkpoint.
- **DEGRADED** — optional non-critical work was skipped by an explicit higher-level policy.
- **FAIL** — unrecoverable or semantic failure; fail closed.

## Reusable API

`scripts/lib/astra-stream-resilience.mjs` exports:

- `runResumableWorkflow(...)`
- `FileCheckpointStore`
- `isTransientStreamError(...)`
- `computeBackoffMs(...)`

Example:

```js
await runResumableWorkflow({
  key: "publish-2026-10-02",
  checkpointPath: "artifacts/resilience/publish-2026-10-02.json",
  steps: [
    { id: "collect", run: collect },
    { id: "validate", run: validate },
    { id: "publish", fingerprint: articleHash, run: publishIdempotently }
  ]
});
```

The `publish` step must use an idempotency key or an equivalent deduplication mechanism so retry/resume cannot duplicate a real-world action.

## Anti-false-PASS proof

`npm run test:stream-resilience` simulates the exact `Stream cache expired` failure, proves automatic recovery, proves restart from the last durable checkpoint, and proves semantic errors are not silently retried.

`npm run guard:stream-resilience` is the lightweight release gate.
