# BETGPT ASTRA Ω — ROI5 Continuous Learning V2

## What changed

The ROI5 dominance/maturity gate is no longer forced to stay permanently at a fixed 8-point dominance / 15-history policy.

Production now runs a fail-closed **champion/challenger** learner over honest settled tickets only:

- only 1X2 side tickets with a real pre-kickoff timestamp are eligible;
- reconstructed/closing/archive prices cannot promote a production policy;
- candidate dominance margins: 6, 7, 8, 9, 10, 11, 12 and 14 percentage points;
- candidate maturity floors: 10, 15, 20, 25 and 30 qualified league observations;
- candidates are selected on the earlier 72% chronological block;
- promotion requires a later 28% holdout with at least 12 selected bets, positive ROI, at least +1.5 percentage points ROI over the validated default, and controlled drawdown;
- if those conditions fail, the system automatically returns to the validated default 8-point / 15-history policy.

## No leakage

A ticket is scored before it is allowed to update segment maturity. A result can therefore influence only later matches. Future rows, unsettled rows, post-kickoff records and reconstructed books cannot train the production policy.

## Continuous trigger

The engine cache key already includes settled-ticket signals. As new results settle, the engine reruns; the ROI5 learner is recalculated against the newly enlarged honest history before upcoming matches are built.

## Important limitation

Continuous learning can improve selection, but it does not guarantee a future ROI increase. The promotion gates are deliberately conservative to prevent a small lucky sample from replacing the validated champion.
