# ASTRA DEPLOY SYNC GATE Ω

Status: ACTIVE · GLOBAL · MANDATORY

## Absolute invariant
`EXPECTED_SOURCE_SHA == DEPLOYED_SOURCE_SHA`

If equality is not proven, the deployment is PARTIAL / FAIL / UNVERIFIED, never PASS.

## Railway adapter
For GitHub-backed Railway services:
- plain `redeploy` is forbidden for a new-source release;
- use `railway redeploy --from-source --yes` or an exact-commit API/GraphQL deployment;
- target the existing canonical service unless architecture genuinely changed;
- compare the Railway deployment commit SHA with the expected GitHub SHA;
- a Railway SUCCESS with a mismatched SHA is a FALSE PASS.

## Required release chain
SOURCE SHA → EXACT-SOURCE DEPLOY → DEPLOYED SHA READBACK → SHA EQUALITY → TERMINAL SUCCESS → RUNTIME/HEALTH → ASTRA CRAWL → BROWSER WHEN RELEVANT → PASS

## Reuse
This gate is inherited by every Git-backed ASTRA OS project.
