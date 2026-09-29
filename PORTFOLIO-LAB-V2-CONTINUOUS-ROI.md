# BetGPT Portfolio Lab V2 — Continuous ROI Learning

Date: 2026-09-27
Mode: RESEARCH / SHADOW until live evidence is sufficient

## Objective

Primary objective is now robust simulated ROI, not headline accuracy. The former 60% hit-rate target remains an informational quality metric, but policy selection and promotion are ROI-first.

## Continuous-learning loop

1. Every settled result becomes training evidence only AFTER settlement.
2. Historical evidence is processed chronologically; future results cannot leak backward.
3. At each retraining checkpoint, multiple challengers are evaluated over multiple chronological blocks.
4. A challenger must be ROI-positive in every learning block and have sufficient sample size.
5. Promotion requires recent ROI uplift over the broad no-filter baseline and controlled drawdown.
6. The champion is frozen for the next evaluation block.
7. If recent champion ROI falls below the baseline or drawdown deteriorates materially, automatic rollback returns the system to no champion / SHADOW.
8. Exact-score hedge remains a separate fail-closed layer: only 1-1 or the predicted losing side winning 2-1, with real listed bookmaker odds required before live promotion.

## Honest prequential replay

Dataset: archived 1X2 home/away tickets, odds 1.80–3.00.
Warmup: 4,500 chronological observations.
Retraining cadence: every 350 observations.
History window: last 6,000 observations.

### Post-learning evaluation

- Continuous ROI learner selections: 605
- Wins: 331
- Hit rate: 54.71%
- Simulated profit: +128.24 normalized units
- Simulated ROI: 21.20%
- Max drawdown: 16.90 units

Broad benchmark on the same post-learning periods (odds 1.80–2.50):

- Selections: 4,893
- Hit rate: 51.54%
- Simulated profit: +524.14 units
- Simulated ROI: 10.71%
- Max drawdown: 21.41 units

ROI lift: +10.49 percentage points.
Drawdown improvement: -4.51 units.

Important: total profit is lower because the ROI learner is much more selective. The user asked to prioritize ROI; this result shows the trade-off clearly.

The replay performed 15 historical promotions and 2 automatic rollbacks. The last historical champion was an away-win Serie A segment at odds 1.90–3.00, but it is NOT automatically trusted live.

## Live counter-audit

The separate honest live-ticket learner currently has 106 walk-forward tickets and detects concept drift. Its newest ROI-first challenger has only 2 holdout observations and therefore remains SHADOW. This prevents the strong historical result from being mistaken for proven current live performance.

## Verification

Targeted learning/hedge tests: 33/33 PASS
- Adaptive learning: 5/5
- Portfolio + continuous ROI learning: 8/8
- Multi-score hedge scope: 9/9
- Hedge profitability gate: 4/4
- Live exact-score / shadow ledger: 7/7

Global legacy suite: 204 PASS / 6 FAIL. The six failures are the pre-existing raw-HTML SSR SEO failures already present before Portfolio Lab V2; no global PASS is claimed.

## Safety / integrity rules

- No future-result leakage.
- No tiny-sample promotion.
- No rule may be selected because of final holdout results.
- Automatic rollback on degradation.
- Live hedge stays SHADOW until timestamped real exact-score bookmaker prices provide enough evidence.
- Normalized exposures are research metrics, not real-money staking recommendations.
