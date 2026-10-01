# ASTRA MODEL MAX ROUTER

Portable quality-first routing policy for current and future projects.

## What it does

- selects the strongest **authorized and actually available** model from a runtime catalog;
- optimizes for quality/reasoning first on critical work;
- uses a second provider/model as an adversarial critic when available;
- keeps a fallback model;
- fails closed for model IDs that were not discovered or are not authorized;
- emits evidence containing the exact model/provider selected.

## What it deliberately cannot do

It cannot grant access to hidden, private, unreleased or account-restricted models. Authorization is a provider/platform boundary, not a prompt or routing problem. The router treats any undiscovered or unauthorized model as unavailable instead of pretending it was used.

## Portable integration

1. Build a provider adapter that returns `AstraModelDescriptor[]` from the provider's authenticated model catalog or account configuration.
2. Call `buildAstraModelMaxPlan(catalog, "critical")`.
3. Invoke `plan.primary`.
4. On critical work, send the result to `plan.critic` for an adversarial review when present.
5. If the primary fails, use `plan.fallback`.
6. Persist `plan.evidence` with run logs.

This keeps the policy reusable across BetGPT and future sites without hard-coding one vendor or model name.
