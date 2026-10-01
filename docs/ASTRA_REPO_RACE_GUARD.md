# ASTRA REPO-RACE GUARD Ω

Concurrent repository movement is treated as normal, not as a user-facing failure.

## Rule

A stale SHA, HTTP 409/422 caused by branch movement, or non-fast-forward push triggers automatic recovery:

1. fetch the latest branch state;
2. discard the stale local base;
3. re-apply the intended semantic mutation on the latest file;
4. commit on the new head;
5. push;
6. verify the remote head;
7. retry up to five times with bounded backoff.

These benign conflicts are **silent**. They are not surfaced to Dr Starck.

Only a genuinely non-reconcilable conflict is surfaced: ambiguous semantic target, permissions/authentication failure, or branch policy requiring human approval.

The guard never solves concurrency by blindly overwriting another valid change.
