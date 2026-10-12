# BetGPT — ASTRA script proof-debt audit (2026-10-12)

**Source:** GitHub Actions [run 38295574282](https://github.com/Dr-starck66/betgpt-railway/actions/runs/38295574282), job `114965704318`.

**Evidence:** 6/6 ASTRA engine regression tests PASS; 11 code-scope brick checks PASS; 2 code-scope bricks UNVERIFIED (ASTRA_OPTIMIZER_OMEGA and ASTRA_NEWS_ELIGIBILITY); 33 ASTRA-named scripts lack a registered proof binding. The strict gate exited 1. This must remain overall **FAIL**, not PASS. Zero-cost and resume-guard jobs succeeded separately; this does not confer universal activation.

## Untracked scripts (33)

- `scripts/astra-authority-citation-engine.mjs` — UNTRACKED; determine owning brick, runnable validation and evidence before PASS
- `scripts/astra-broadcast-affiliate-guard.mjs` — UNTRACKED; determine owning brick, runnable validation and evidence before PASS
- `scripts/astra-cloud-bridge.mjs` — UNTRACKED; determine owning brick, runnable validation and evidence before PASS
- `scripts/astra-cloud-egress.mjs` — UNTRACKED; determine owning brick, runnable validation and evidence before PASS
- `scripts/astra-content-omega-proof.mjs` — UNTRACKED; determine owning brick, runnable validation and evidence before PASS
- `scripts/astra-deploy-sync-gate.mjs` — UNTRACKED; determine owning brick, runnable validation and evidence before PASS
- `scripts/astra-editorial-authority-gate.ts` — UNTRACKED; determine owning brick, runnable validation and evidence before PASS
- `scripts/astra-editorial-corpus-audit.ts` — UNTRACKED; determine owning brick, runnable validation and evidence before PASS
- `scripts/astra-green-release-sync.mjs` — UNTRACKED; determine owning brick, runnable validation and evidence before PASS
- `scripts/astra-heading-architecture-guard.mjs` — UNTRACKED; determine owning brick, runnable validation and evidence before PASS
- `scripts/astra-launch-video-guard.mjs` — UNTRACKED; determine owning brick, runnable validation and evidence before PASS
- `scripts/astra-launch-video.mjs` — UNTRACKED; determine owning brick, runnable validation and evidence before PASS
- `scripts/astra-match-route-resilience-guard.mjs` — UNTRACKED; determine owning brick, runnable validation and evidence before PASS
- `scripts/astra-mobile-parity-guard.mjs` — UNTRACKED; determine owning brick, runnable validation and evidence before PASS
- `scripts/astra-model-max-guard.mjs` — UNTRACKED; determine owning brick, runnable validation and evidence before PASS
- `scripts/astra-never-fail-build-guard.mjs` — UNTRACKED; determine owning brick, runnable validation and evidence before PASS
- `scripts/astra-odds-truth-guard.mjs` — UNTRACKED; determine owning brick, runnable validation and evidence before PASS
- `scripts/astra-public-autosync.mjs` — UNTRACKED; determine owning brick, runnable validation and evidence before PASS
- `scripts/astra-public-proxy.mjs` — UNTRACKED; determine owning brick, runnable validation and evidence before PASS
- `scripts/astra-public-route-gate.mjs` — UNTRACKED; determine owning brick, runnable validation and evidence before PASS
- `scripts/astra-public-seo-readiness-gate.mjs` — UNTRACKED; determine owning brick, runnable validation and evidence before PASS
- `scripts/astra-release-gate.mjs` — UNTRACKED; determine owning brick, runnable validation and evidence before PASS
- `scripts/astra-resume-guard.mjs` — UNTRACKED; determine owning brick, runnable validation and evidence before PASS
- `scripts/astra-safe-push.mjs` — UNTRACKED; determine owning brick, runnable validation and evidence before PASS
- `scripts/astra-semantic-flow-autorepair.mjs` — UNTRACKED; determine owning brick, runnable validation and evidence before PASS
- `scripts/astra-seo-self-heal.mjs` — UNTRACKED; determine owning brick, runnable validation and evidence before PASS
- `scripts/astra-sidewing-audit.mjs` — UNTRACKED; determine owning brick, runnable validation and evidence before PASS
- `scripts/astra-sitemap-runtime-sample-gate.mjs` — UNTRACKED; determine owning brick, runnable validation and evidence before PASS
- `scripts/astra-social-amplifier.mjs` — UNTRACKED; determine owning brick, runnable validation and evidence before PASS
- `scripts/astra-social-oauth-vault.mjs` — UNTRACKED; determine owning brick, runnable validation and evidence before PASS
- `scripts/astra-software-heritage-archive.mjs` — UNTRACKED; determine owning brick, runnable validation and evidence before PASS
- `scripts/astra-stamp-revision.mjs` — UNTRACKED; determine owning brick, runnable validation and evidence before PASS
- `scripts/astra-wait-public-revision.mjs` — UNTRACKED; determine owning brick, runnable validation and evidence before PASS

## Remediation gate

1. Identify the intended owner brick and affected task for each script.
2. Add functional executable tests, not only file-existence or syntax checks; validate failure modes.
3. Only exempt a script if it is demonstrably a helper, with a substantive documented rationale. No blanket exemptions.
4. Keep the GitHub check strict; re-run before production changes. No deploy until the intended site checks and Railway health are proven.
5. Status after this inventory: **FAIL / PARTIAL coverage**. The separate public production service was not modified by this PR.
