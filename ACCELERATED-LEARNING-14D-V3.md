# BetGPT — Accelerated Learning 14D V3

## Objective

Operational target: **>= 60% settled winning bets at decimal odds >= 1.80**. This is a validation target, not a guaranteed return.

## What changed

1. **11k+ historical outcomes become a low-weight prior**. They accelerate pattern learning but never count as proof of the betting KPI because historical/closing prices are not equivalent to a timestamped pre-kickoff bet.
2. **Every honest ticket is evaluated walk-forward**. The model is scored before its own result is inserted, so it cannot learn the answer it is being tested on.
3. **Hierarchical trust score** combines market, market family, league, odds band, probability band, market+odds and family+league. Sparse segments are shrunk toward the global baseline.
4. **Champion/challenger** searches hundreds of conservative policies on the training window. Promotion requires a later chronological holdout with >=60% hit rate, positive flat-stake ROI, and enough selected bets.
5. **Concept-drift detector** compares previously high-trust segments with the most recent window. A sharp deterioration blocks fake promotion.
6. **Negative learning is immediate**. Segments with enough honest observations and extremely poor realized hit rate become `AVOID` safety blocks even while positive challenger policies remain SHADOW.
7. **Hard odds floor**: no production BET below 1.80.

## Current evidence snapshot

Generated from the bundled ledger, the V3 report is stored at `data/adaptive-learning-report.json` and exposed by `/learning-target.json` when deployed.

The report deliberately separates:
- archive prior,
- honest timestamped tickets,
- top-trust retrospective diagnostics,
- untouched holdout results,
- toxic segments,
- drift state.

A high retrospective percentage is never allowed to auto-promote a policy if the holdout fails.

## Two-week acceleration loop

On every settlement:

`RESULT -> CLASSIFY ERROR -> UPDATE SEGMENTS -> UPDATE TRUST -> RUN CHALLENGERS -> WALK-FORWARD -> HOLDOUT -> PROMOTE OR KEEP SHADOW -> NEXT MATCH`

The fastest safe path to 60% is **selectivity**, not forcing more bets. `NO_BET` is a valid and preferred output when the evidence is weak.
