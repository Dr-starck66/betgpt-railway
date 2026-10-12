# ASTRA Ω — Safe execution preflight for BetGPT

Validated on 2026-10-12 UTC. All changes remain in draft PR #70, not in Railway production.

## What actually runs
- `node --test scripts/astra-risk-dry-run.test.mjs` — seven negative tests (including a deliberately destructive fixture that MUST NOT execute).
- `node scripts/astra-risk-dry-run.mjs --all --report=artifacts/astra-risk-preflight/report.json` — statically read and SHA-256 hash 14 registered high-risk scripts, without importing or executing them, without external calls.
- `node scripts/astra-risk-dry-run.mjs --script=scripts/astra-social-amplifier.mjs` — inspect one allowlisted entrypoint.
- `node scripts/astra-safe-push.mjs --astra-dry-run --branch proof-local artifacts/report.json` — preview the git push plan, no `git` commands.
- `node scripts/astra-never-fail-build-guard.mjs --astra-dry-run` — validate its configured build-check list, without running a check or writing a release report.

## Proof meanings
`INSPECTION_COMPLETE` and `INSPECTED_ONLY` mean ONLY the preview implementation worked. They DO NOT mean OAuth token refresh, social publication, git pushes, deployment, archive publication or actual video rendering succeeded. Individual scripts' execution status remains **UNVERIFIED**.

`ASTRA_OPTIMIZER_OMEGA` is imported from the existing controller in `Dr-starck66/indexation`. Run:
```sh
node --test scripts/astra-optimizer-omega.test.mjs
node scripts/astra-optimizer-omega.mjs --portfolio=config/astra-optimizer-portfolio.json --output=artifacts/astra-optimizer/betgpt-audit.json
```
The optimizer requires provider-backed, fresh, SHA-256-matched outcome observations and a live capability audit. When these are absent its outcome status is `UNVERIFIED`, and ASTRA MASTER GATE must not transform it into PASS merely because the Node process exits with zero.

## Boundaries
No external provider OAuth passwords or tokens are needed or printed by the preflight. No file is changed except the optional local `artifacts/` report. All 14 source files remain ordinary application scripts when explicitly invoked outside this safe preflight; the simulator is NOT a universal sandbox and does not prevent other workflows from directly invoking them. Production promotion is still blocked pending independent live evidence.

GitHub proof: https://github.com/Dr-starck66/betgpt-railway/pull/70
