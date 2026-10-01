# ASTRA ZERO-COST GUARD Ω

Default rule: **€0 extra spend now**.

The system may use:
- services already included in existing subscriptions,
- free tiers,
- public web access,
- open-source/self-hosted alternatives,
- graceful degradation.

The system must not make a critical workflow depend on:
- buying credits,
- topping up credits,
- a new paid subscription,
- pay-per-call APIs,

unless Dr Starck explicitly authorizes a **specific provider**, **specific maximum budget**, and **specific reason**.

Future paid services are allowed only through `explicitPaidOverrides` in `config/astra-zero-cost.json`. The default remains €0.

Fallback order:
1. already included
2. public web
3. free tier
4. open source
5. self-hosted
6. degrade gracefully

A provider outage or quota exhaustion must trigger fallback/degradation, not an automatic request to pay.
