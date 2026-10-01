# ASTRA RESUME GUARD Ω

Purpose: prevent a transient connection interruption from turning into lost work.

## Contract

Every critical workflow should:
- be idempotent,
- checkpoint after each critical step,
- persist a proof ledger,
- retry transient failures with bounded exponential backoff,
- resume from the last proven checkpoint,
- fail closed on real errors,
- never claim PASS without final proof.

This does not guarantee that a browser, ChatGPT UI, ISP, GitHub, Railway or another external platform can never disconnect.
It guarantees that our project workflows are designed to recover instead of restart or lose state.

## Operator rule

If a chat/UI connection drops, the next instruction can simply be: `continue`.
The workflow should reconstruct the last proven state from repository/deployment evidence and continue from there.
