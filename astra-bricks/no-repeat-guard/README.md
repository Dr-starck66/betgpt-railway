# ASTRA NO-REPEAT GUARD Ω

## Contract

A requirement already established by the user is active by default until explicitly revoked. The user must not have to repeat it.

## Mandatory pipeline

1. Recover applicable prior requirements from project memory, repository docs, manifests, guards, and available conversation context.
2. Build a deduplicated requirement ledger before editing.
3. Expand scope: check every affected route/component/site surface, not only the page that exposed the bug.
4. Apply the shared implementation rather than a one-off patch whenever possible.
5. Give each persistent requirement at least one machine-verifiable guard.
6. Run the guards before build/deploy.
7. A known persistent requirement without a guard is **UNGUARDED**, never PASS.
8. Any regression of a prior requirement is **FAIL** even if the new feature itself works.
9. The most recent explicit user rule wins when two requirements conflict.
10. Never ask the user to repeat information that is already retrievable.

## Requirement registry

BetGPT's machine-readable registry is `config/astra-no-repeat-guard.json`.
The validator is `scripts/astra-no-repeat-guard.mjs`.
It is wired into `npm run prebuild`.

When a new persistent requirement is added, update the registry and add a machine check in the same change.
