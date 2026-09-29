# BetGPT — Selective 1–1 Hedge V1

## Decision
The previous systematic 1–1 hedge is rejected. The new hedge is selective and fail-closed.

Current candidate rule discovered without using the final holdout for selection:

- main bet: HOME/AWAY 1X2 only;
- main odds: 1.80–2.50;
- competition: La Liga (`LL`);
- model probability of exact 1–1: >= 14.3%;
- recovery target: 50% of the main stake loss;
- hedge stake: `mainStake * 0.50 / (listed11Odds - 1)`;
- hard cap: 10% of main stake;
- real bookmaker 1–1 odds required;
- exact-score EV gate: `p11 * listed11Odds - 1 >= 5%`;
- current production status: **SHADOW**.

## Chronological evidence
The 8,310 historical HOME/AWAY 1X2 predictions with main odds 1.80–2.50 were split chronologically 60% / 20% / 20%. Candidate selection used train + validation only. The last 20% remained untouched until the rule was fixed.

| Split | Selective hedges | Hedge-only ROI* | Portfolio profit delta | Portfolio ROI delta | Max drawdown delta |
|---|---:|---:|---:|---:|---:|
| Train | 457 | +24.27% | +8.57 u | +0.115 pp | -1.29 u |
| Validation | 135 | +43.83% | +4.57 u | +0.206 pp | -0.11 u |
| Final holdout | 138 | +56.84% | +6.07 u | +0.313 pp | -0.61 u |

`*` Hedge-only ROI uses reconstructed/synthetic exact-score prices from the historical BetGPT model, so it is diagnostic rather than deployable bookmaker evidence.

On the untouched holdout, the complete portfolio moves from roughly **7.82% ROI without the hedge to 8.13% with the selective 50% hedge**, while maximum drawdown decreases by about 0.61 unit.

## Why SHADOW, not ACTIVE
The historical archive contains final scores but not timestamped bookmaker 1–1 prices. Synthetic exact-score prices are useful for detecting a promising segment, but cannot certify real-world execution economics. BetGPT therefore requires a real listed 1–1 quote before a hedge can even qualify and keeps the policy in SHADOW until enough real quotes and settled outcomes validate it.

## Fail-closed rules
- Never hedge a draw pick with 1–1.
- Never hedge outside the validated segment.
- Never invent an exact-score quote.
- Never promote from SHADOW on retrospective performance alone.
- Keep the hedge optional; a missing or weak quote returns `NO_HEDGE`.
- Re-run chronological validation as new settled bets arrive.

No historical metric is a guarantee of future profitability.
