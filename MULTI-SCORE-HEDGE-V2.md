# BetGPT — Multi-Score Selective Hedge V2

Date: 2026-09-27

## Question
Compare four exact-score insurance strategies on the same BetGPT historical 1X2 portfolio (main odds 1.80–2.50):

1. 1–1 hedge recovering 50% of the main stake loss;
2. 1–1 hedge recovering 100%;
3. exact 2–1 **against the team BetGPT predicted to win**, recovering 50%;
4. the same opponent-2–1 hedge recovering 100%.

For a HOME main pick, “opponent wins 2–1” means final score **1–2**. For an AWAY main pick, it means **2–1**.

The hedge stake is `mainStake × recoveryFraction / (exactScoreOdds - 1)`.

## Historical sample
- 8,310 HOME/AWAY 1X2 predictions with main odds 1.80–2.50.
- Main portfolio without hedge: **+704.47 units**, **8.48% ROI**, max drawdown **78.81 units**.
- 4,138 main-bet losses.
- 1–1 accounts for 1,028 losses = **24.84% of all main losses**.
- opponent 2–1 accounts for 494 losses = **11.94% of all main losses**.

## Systematic comparison

| Strategy | Profit | ROI on total capital | Max drawdown | Mean hedge stake |
|---|---:|---:|---:|---:|
| No hedge | +704.47 u | **8.48%** | 78.81 u | 0 |
| 1–1 / recovery 50% | +669.59 u | 7.49% | 80.09 u | 7.54% of main stake |
| 1–1 / recovery 100% | +634.70 u | 6.64% | 84.31 u | 15.08% |
| Opponent 2–1 / recovery 50% | +715.10 u | **8.35%** | 78.23 u | 3.03% |
| Opponent 2–1 / recovery 100% | **+725.72 u** | 8.23% | **77.89 u** | 6.05% |

### Systematic verdict
Among the four hedge variants, **opponent 2–1 at 50% has the best ROI**. Opponent 2–1 at 100% has the **highest absolute profit and lowest drawdown**. However, the unhedged portfolio still has a slightly higher ROI than either systematic 2–1 hedge, because the hedge consumes additional capital on every match.

This confirms the user's intuition that the much larger 2–1 exact-score price can make a very small insurance stake economically more attractive than a systematic 1–1 hedge.

## Selective search protocol
The 8,310 matches were kept in chronological order and split **60% train / 20% validation / 20% untouched holdout**. Rule selection used only train + validation. The final 20% was not used to choose rules.

Candidate dimensions included league, HOME/AWAY main side, main-odds range, main-model probability, draw probability, exact-score model probability, score type and recovery fraction.

Two simple segments survived train + validation and were frozen before the holdout check:

- **1–1:** La Liga, HOME main pick, main odds 1.80–2.50, main model probability ≤47%; retrospective best recovery = 100%.
- **Opponent 2–1:** HOME main pick, any league, main odds 1.80–2.20, main model probability ≤47%; retrospective best recovery = 100%. For HOME picks the hedge score is 1–2.

When both qualified in the historical combination test, 1–1 received priority because it had the larger validation uplift. The production-facing SHADOW selector improves this by requiring real bookmaker prices and choosing the single qualifying score with the higher expected incremental PnL per unit of main stake.

## Chronological selective result

| Split | Base ROI | Selective multi-score ROI | Profit uplift | Drawdown change |
|---|---:|---:|---:|---:|
| Train | 7.90% | **8.17%** | +25.62 u | -1.58 u |
| Validation | 10.87% | **11.69%** | +18.40 u | -2.18 u |
| Final holdout | 7.82% | **8.59%** | +17.01 u | -1.64 u |

The final holdout used 484 selective hedges: 208 in the 1–1 segment and 276 in the opponent-2–1 segment after overlap resolution.

A simple bootstrap on the fixed holdout policy gives a positive 95% interval for **profit uplift** of roughly +2.1 to +33.3 units, while the ROI-uplift interval still brushes slightly below zero. This is encouraging but not enough to claim certainty.

## Fail-closed production design
A new `selective-score-hedge.ts` engine has been added. It:

- chooses **at most one** exact-score hedge per match;
- supports 1–1 and opponent-2–1 candidate scores;
- requires timestamped bookmaker exact-score odds;
- requires positive exact-score EV;
- rejects a hedge if the stake needed for the requested recovery is too large;
- remains `SHADOW`;
- currently rejects AWAY-pick opponent-2–1 segments because they failed the final holdout;
- never stacks both exact scores merely to make the historic backtest look better.

## Major limitation
The historical archive contains final scores but not timestamped bookmaker exact-score quotes. Exact-score odds used in this retrospective test are reconstructed from the BetGPT Poisson/Dixon model. Therefore the result is **research evidence, not executable bookmaker proof**. Real quotes must be logged before SHADOW can become ACTIVE.

No retrospective result guarantees future gambling profit.
