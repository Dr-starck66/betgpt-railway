# ASTRA SINGLE-SOURCE RELEASE GATE Ω

Reusable release safety brick for every current and future site.

## Absolute invariants

1. **One application source of truth.** A public domain may bind directly to the canonical service or pass through a routing-only shim, but no legacy service may build or serve its own independent application revision.
2. **Revision convergence.** Public domain and canonical origin must expose the same immutable source SHA.
3. **Fail closed.** FAIL or PARTIAL is never promoted to PASS.
4. **Publishing is transactional.** Tests, module resolution and content/social gates must pass before the real publish command is allowed to execute.
5. **Evidence is durable.** Every run writes machine-readable JSON evidence.
6. **No local-network dependency.** Postflight verification runs from CI/cloud and compares public and canonical origins remotely.

## Files to reuse

- `scripts/astra-release-gate.mjs`
- `config/astra-release-gate.json`
- `.github/workflows/astra-release-gate.yml`

Each site changes only its manifest: site ID, canonical origin, public domains and pipeline command profiles.

## Modes

- `validate`: manifest validation.
- `preflight`: build/test gates before promotion.
- `pipeline <name>`: transactional workflow gate, e.g. editorial publication.
- `postflight`: compare health + immutable revision between canonical origin and every public domain.

## Routing rule

Preferred architecture is a custom domain directly attached to the canonical service.

If a platform connector cannot atomically transfer a custom domain, the only accepted temporary topology is a **routing-only shim**. The shim must not clone, download, build or run the site. It must proxy the canonical service and emit a configured `x-astra-public-proxy` fingerprint. The postflight gate rejects stale independent revisions.

## Provider deployment rule

During every deployment, provider inventory must identify the canonical service and every custom-domain holder. If more than one service can independently serve application code for the same public hostname, deployment is FAIL until all non-canonical holders are detached or converted to routing-only shims.

## Editorial rule

A scheduled publishing workflow must execute the named pipeline profile. The profile runs module-resolution smoke checks, editorial tests, social tests and only then the real publish command. Any failure prevents ledger persistence or downstream social publication.
