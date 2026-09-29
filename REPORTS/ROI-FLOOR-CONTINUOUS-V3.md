# BetGPT — Dynamic ROI Floor V3

Date: 2026-09-27
Mode: RESEARCH / SHADOW until current live evidence is sufficient

## Objective
Maximize robust simulated ROI while refusing bets below the currently learned minimum odds floor. A challenger cannot be promoted unless its recent ROI is at least 13%, beats the recent baseline by the configured uplift, stays profitable, has enough observations, and does not worsen drawdown beyond the guardrail.

## What changed
- The minimum accepted 1X2 odds is now a learned parameter, not a permanent 1.80 constant.
- Candidate floors: 1.80, 1.85, 1.90, 1.95, 2.00, 2.05, 2.10, 2.15, 2.20, 2.25, 2.30.
- The active champion forbids every bet below its own learned floor.
- Promotion target: absolute recent ROI >= 13% plus the relative ROI-uplift gate.
- Automatic rollback remains active when recent ROI falls below the stronger of the recent baseline or the 13% target, or drawdown deteriorates materially.
- The exact-score hedge remains optional and selective: only 1-1 or the predicted losing side winning 2-1; at most one hedge per match.

## False-PASS audit
An initial combined replay contained a bug in the opponent-2-1 settlement check: a selected opponent-2-1 hedge was incorrectly counted as a hit without comparing the final score. That run was discarded. The settlement condition was corrected to compare the exact final score, and all headline figures below come only from the corrected run.

## Static minimum-odds test
Raising the floor mechanically was not consistently beneficial. Threshold rankings changed across chronological periods, which is evidence against hard-coding one floor forever.

A nested research selection using development data only chose 2.20 as the fixed floor. On the following chronological period it produced 237 selected bets and 19.15% simulated ROI, versus 5.28% for the broad comparable baseline. However, other floors changed rank on that later period, confirming regime dependence. Therefore V3 learns the floor continuously instead of fixing 2.20 permanently.

## Prequential continuous replay
The learner processes results in chronological order. A future result never participates in the policy that predicted it.

### Broad benchmark
- Selections: 4,893
- Hit rate: 51.54%
- Simulated profit: +524.14 normalized units
- Simulated ROI: 10.71%
- Max drawdown: 21.41 units

### Dynamic floor, no exact-score hedge
- Selections: 393
- Hit rate: 53.69%
- Simulated profit: +95.44 units
- Simulated ROI: **24.29%**
- Max drawdown: 17.22 units

### Dynamic floor + selective exact-score hedge
- Main selections: 393
- Selective hedges: 25
- Exact-score hedge hits: 5
- Total normalized capital: 396.19 units
- Simulated profit: +97.91 units
- Simulated ROI: **24.71%**
- Max drawdown: **16.40 units**

The selective hedge therefore adds about +0.43 percentage point of simulated ROI in this replay while slightly lowering drawdown. It is not forced; most selected bets receive no hedge.

The final historical champion is a Serie A away-win segment with a 2.00 minimum odds floor and 3.00 maximum odds. This is a historical state, not a permanent rule; the learner may replace or roll it back as new settled results arrive.

## Final-period counter-check
Starting learning from the first 80% and evaluating only the following chronological period produced:
- 88 selected bets
- 57.95% hit rate
- +33.18 normalized units
- 37.71% simulated ROI
- 5.00 units max drawdown

No exact-score hedge qualified in this final-period selected subset. The sample is small, so 37.71% is evidence of selectivity, not a credible future-return promise.

## Integrity rules
- NO BET below the active champion's minimum odds floor.
- NO BET when there is no promoted champion.
- No promotion below 13% recent simulated ROI.
- No future leakage.
- No tiny-sample promotion.
- Automatic rollback on drift.
- Hedge is optional and must beat the same no-hedge portfolio before live promotion.
- Historical exact-score odds are reconstructed/synthetic; live hedge promotion still requires timestamped real bookmaker prices.

## Interpretation
The strongest result is not a permanent magic threshold. It is that allowing the minimum odds floor itself to learn and change improved the corrected prequential research ROI from the previous 21.20% learner to 24.29%, and selective hedging lifted it modestly to 24.71%. Live SHADOW evidence must confirm this before any ACTIVE claim.
