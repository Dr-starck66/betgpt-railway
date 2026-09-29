# BetGPT Accelerated Learning V1

Objective: measure, not manufacture, a >=60% win rate on selections with decimal odds >=1.80.

## Hard invariants
- Odds below 1.80 are never eligible for the target method.
- A candidate needs calibrated model probability >=60% and positive expected value (default >=8%).
- If no candidate qualifies, the correct output is NO BET. There is no forced fallback pick.
- Historical learning is chronological. The final 25% is held out as an unseen validation tail.
- Promotion requires at least 30 settled validation bets, >=60% hit rate, positive ROI, and stability versus training.
- Failed market/league/odds bands are surfaced as error buckets for subsequent tightening.
- Results are not rewritten. Pre-kickoff records remain the source of truth.

## Two-week acceleration
Use all already-settled historical tickets immediately for error mining and calibration. Re-run the audit after every settlement. Challengers may be trained on the past, but only a future/unseen validation segment can promote them.
