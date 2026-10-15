# ASTRA BETGPT LEARNING REFRESH GATE Ω (2026-10-15)

Symptom: live /api/learning-checkpoint returned 15 HTTP 503 in the last 24h (and a 18-second timeout); previous builds coupled mandatory live feed, slow historical recovery, and memory proof. BetGPT web and its llama.cpp chat model were independently healthy. This is not model-weight training.

Change:
- Coalesce concurrent inbound checkpoint refreshes; no provider request fan-out.
- Accept only a non-stale, nonempty live sports snapshot fetched in last 10 minutes. Cache reuse is explicitly reported as FRESH_CACHE; an old snapshot cannot yield PASS. Upstream failures with no fresh data are HTTP 503, with 45s cooldown to prevent storms.
- Bound fresh live acquisition to 12s and historical results catch-up to 3s. A slow recovery is DEGRADED (with error) but does not discard existing fresh settled learning; when it later completes, it safely syncs to ticket ledger. Recovery is single-flight and at most one new run per 90 seconds.
- Fix one-shot ticket hydration races: concurrent calls share a Promise, 4s timeout on GitHub fallback. Merge in-memory tickets already recorded during hydration before completing it.
- Keep the existing checkpoint schema v2 and its truthful FAIL / PASS semantics, plus refresh.source, recovery.status and timestamps for independent verification.
- Eight isolated unit tests cover stale/no false PASS, provider timeout, recovery timeout, concurrency/cooldown, cached truth, and retry.
- Production promotion remains behind immutable GREEN source manifest and ASTRA release gate. No manual override; pass only after native tests, production HTTP and distinct fresh snapshots are evidenced. Status before production: UNVERIFIED.
