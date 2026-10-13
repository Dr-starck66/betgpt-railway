# BetGPT ASTRA Ω — evidence debt after real CI validation

Updated: 2026-10-12 22:25 UTC.
Evidence: [GitHub Actions run 38316535659](https://github.com/Dr-starck66/betgpt-railway/actions/runs/38316535659).

- Central engine: **7/7 regression tests PASS**, including registry completeness with all 41 canonical IDs.
- Code-scope brick proofs: **12 PASS, 1 UNVERIFIED (ASTRA_OPTIMIZER_OMEGA), 0 executable FAIL**.
- ASTRA source scripts still **untracked: 18** (down from 33). Some newly mapped scripts are in task scopes other than code and **not all have been executed by this run**.
- Global strict audit: **FAIL**, by design; production BetGPT **unchanged**.
- ASTRA_NEWS_ELIGIBILITY: actual editorial source and authority tests plus News XML negative fixtures pass locally. Public sitemap or Google News inclusion is **UNVERIFIED**, never infer inclusion from unit tests.

## High-risk scripts — not to execute in a general CI audit

- `scripts/astra-authority-citation-engine.mjs` — UNVERIFIED; first establish dry-run, permission scope, rollback and a safe negative fixture
- `scripts/astra-cloud-bridge.mjs` — UNVERIFIED; first establish dry-run, permission scope, rollback and a safe negative fixture
- `scripts/astra-deploy-sync-gate.mjs` — UNVERIFIED; first establish dry-run, permission scope, rollback and a safe negative fixture
- `scripts/astra-green-release-sync.mjs` — UNVERIFIED; first establish dry-run, permission scope, rollback and a safe negative fixture
- `scripts/astra-launch-video.mjs` — UNVERIFIED; first establish dry-run, permission scope, rollback and a safe negative fixture
- `scripts/astra-public-autosync.mjs` — UNVERIFIED; first establish dry-run, permission scope, rollback and a safe negative fixture
- `scripts/astra-public-proxy.mjs` — UNVERIFIED; first establish dry-run, permission scope, rollback and a safe negative fixture
- `scripts/astra-public-route-gate.mjs` — UNVERIFIED; first establish dry-run, permission scope, rollback and a safe negative fixture
- `scripts/astra-safe-push.mjs` — UNVERIFIED; first establish dry-run, permission scope, rollback and a safe negative fixture
- `scripts/astra-social-amplifier.mjs` — UNVERIFIED; first establish dry-run, permission scope, rollback and a safe negative fixture
- `scripts/astra-social-oauth-vault.mjs` — UNVERIFIED; first establish dry-run, permission scope, rollback and a safe negative fixture
- `scripts/astra-software-heritage-archive.mjs` — UNVERIFIED; first establish dry-run, permission scope, rollback and a safe negative fixture
- `scripts/astra-stamp-revision.mjs` — UNVERIFIED; first establish dry-run, permission scope, rollback and a safe negative fixture
- `scripts/astra-wait-public-revision.mjs` — UNVERIFIED; first establish dry-run, permission scope, rollback and a safe negative fixture

## Read-only candidates requiring independent proof

- `scripts/astra-cloud-egress.mjs` — UNVERIFIED; may qualify for an isolated, non-mutating command check after input and outputs are validated
- `scripts/astra-model-max-guard.mjs` — UNVERIFIED; may qualify for an isolated, non-mutating command check after input and outputs are validated
- `scripts/astra-never-fail-build-guard.mjs` — UNVERIFIED; may qualify for an isolated, non-mutating command check after input and outputs are validated
- `scripts/astra-sidewing-audit.mjs` — UNVERIFIED; may qualify for an isolated, non-mutating command check after input and outputs are validated

No blanket exemptions have been added. Tracking a path in a manifest is not equivalent to executing or passing that script. Deploy only after site-specific real checks and public health verification.
