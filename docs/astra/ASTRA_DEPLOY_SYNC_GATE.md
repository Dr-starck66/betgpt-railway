# ASTRA DEPLOY SYNC GATE Ω

Status: ACTIVE · GLOBAL · MANDATORY

## Mission
Prevent every stale-code false PASS in Git-backed ASTRA OS releases.

## Release truth model
A raw repository HEAD is **not automatically production**.

For guarded production pipelines, ASTRA OS separates:
1. **SOURCE_HEAD** — newest repository commit; may still be under validation.
2. **GREEN_RELEASE_SHA** — immutable commit that passed the promotion gate.
3. **MANIFEST_SHA** — immutable source selected by the deployment wrapper.
4. **PUBLIC_SHA** — revision actually served to users.

The mandatory production invariant is:

`GREEN_RELEASE_SHA == MANIFEST_SHA == PUBLIC_SHA == CANONICAL_PUBLIC_SHA`

SOURCE_HEAD may be newer while validation is running. That is normal and must not trigger a false failure or an unsafe auto-promotion.

## Required-fix invariant
When a release is intended to contain a specific fix:
- `REQUIRED_FIX_SHA` must equal or be a Git ancestor of `GREEN_RELEASE_SHA`.
- A GREEN/public revision older than, unrelated to, or unverifiable against the required fix is FAIL.
- A newer verified descendant is acceptable.

## BetGPT guarded promotion architecture
- Canonical source repo: `Dr-starck66/betgpt-railway`
- Promotion wrapper repo: `Dr-starck66/zip-github`
- Wrapper root: `betgpt-railway-live`
- GREEN marker: `.astra-green-release.json`
- Immutable source manifest: `source-manifest.json`
- Public production Railway service: `betgpt` / `9ad5c668-b27c-4b07-a9d6-e030380751d1`
- Public Railway origin: `https://betgpt-production-7353.up.railway.app`
- Public domain: `https://betgpt.live`
- Direct-source validation/build service: `betgpt-complete-v5` / `164fe51e-b1a3-413d-83eb-b50e29a03caa`

The public service is intentionally a guarded promotion wrapper. It must not be confused with the direct-source validation/build service.

## Promotion proof
Before public production may be called PASS:
1. GREEN marker schema is valid and `greenVerified=true`.
2. GREEN marker source repo is the canonical source repo.
3. GREEN marker SHA is immutable (40-char Git SHA).
4. Source manifest repo and SHA equal the GREEN marker.
5. Promotion key equals `repo@sha`.
6. Promotion controller/workflow proof is valid.
7. Deployment wrapper fetches that exact immutable source SHA.
8. Public `/api/astra-revision` reports the same SHA.
9. Canonical public origin reports the same SHA.
10. Public health passes.
11. ASTRA CRAWL verifies the intended feature/content.
12. Playwright/browser verification is required for visual/interactive claims.

## Executable gates
- `scripts/astra-deploy-sync-gate.mjs`: direct Git-backed host adapter, including Railway from-source behavior.
- `scripts/astra-green-release-sync.mjs`: guarded-promotion adapter proving GREEN ↔ manifest ↔ public/canonical revision equality.
- `.github/workflows/astra-release-gate.yml`: runs GREEN/public parity as a mandatory drift sentinel.

## Watch-path rule
Direct-source auto-deploy services are trusted only when every production-affecting path is watched. Typical inputs:
- `src/**`
- `server/**`
- `api/**`
- `data/**`
- `config/**`
- `scripts/**`
- `migrations/**`
- `public/**`
- package/lock/build/runtime config files

Missing relevant watch paths means auto-deploy is UNVERIFIED until an explicit source-refreshing deploy is proven.

## Railway rule
Plain Railway `redeploy` may replay an existing snapshot. It is forbidden as proof of a new-source release.
Use from-source, exact-commit, guarded immutable-manifest promotion, or another source-refreshing mechanism, then read back evidence.

## PASS chain
PROJECT DNA → RELEASE ROLE RESOLUTION → REQUIRED FIX → GREEN GATE → IMMUTABLE MANIFEST → GUARDED DEPLOY → PUBLIC REVISION READBACK → GREEN/MANIFEST/PUBLIC PARITY → PUBLIC HEALTH → ASTRA CRAWL → BROWSER WHEN RELEVANT → PASS

## Origin
BetGPT exposed two false-PASS classes:
1. Railway could report SUCCESS while replaying an older direct-source snapshot.
2. The direct build service SHA could differ from the intentionally guarded public release SHA.

ASTRA OS now models both cases explicitly instead of treating every SHA difference as the same failure.
