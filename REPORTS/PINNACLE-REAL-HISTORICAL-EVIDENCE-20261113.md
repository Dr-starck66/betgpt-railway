# ASTRA BetGPT Ω — Pinnacle historical evidence (2026-11-13)

**Scope:** retrospective Premier League 1X2 market benchmark, strictly read-only. NOT a live Pinnacle integration, not a validated value-bet model, and not evidence of profitability.

## Sources and integrity
- Primary: https://www.football-data.co.uk/mmz4281/2425/E0.csv — SHA-256 `a0fb4e281b6f0e0fce66ac4c6bca53e54686d2db6054b5eb49b90decf161c12f`
- Negative control: https://www.football-data.co.uk/mmz4281/2526/E0.csv — SHA-256 `25b1ecbf34c961fbe9a3a3b3bf906a6c7cf76121d4605ed11a1106cc4d15de7f`
- Football-Data field definitions: https://www.football-data.co.uk/notes.txt
- Source warning: https://www.football-data.co.uk/data — since 2025-07-23 the Pinnacle public API supplied systematically outdated odds. Do not treat recent `PSCH/PSCD/PSCA` as live/current or precise closing prices.

The repo does not redistribute raw CSV files. The network source is a public research archive; cite Football-Data.co.uk in reuse.

## Reproducible cloud execution (actual HTTP retrieval; Vercel Sandbox)
Environment: short-lived, 1 vCPU / 2 GB, Node.js runtime, read-only Git checkout of `Dr-starck66/betgpt-railway`, `astra/pinnacle-value-research-20261113`, commit `40cafaac`. Outbound allowlist GitHub + football-data.co.uk; no external auth, secret, production deploy, or betting order.

Commands:
```sh
node --test scripts/audit-pinnacle-historical.test.mjs
node scripts/audit-pinnacle-historical.mjs --season 2425
node scripts/audit-pinnacle-historical.mjs --season 2526
```
All three commands executed with **exit code 0**. Unit tests **10/10 PASS**. The CSVs were fetched through HTTPS directly from the publisher, not local fixtures.

## Positive control — 2024/2025 Premier League
| Metric | Observed |
|:--|--:|
| CSV rows | 380 |
| Valid unique finished fixtures | 380 |
| Complete Pinnacle closing 1X2 triples | 380 |
| Paired Bet365 closing 1X2 triples | 380 |
| Coverage | 100% |
| First and last Pinnacle match dates | 2024-08-16 / 2025-05-25 |
| Median Pinnacle proportional overround | 2.9392% |
| Pinnacle multiclass Brier (sum of 3 squared errors) | 0.575079 |
| Bet365 multiclass Brier on identical fixtures | 0.575775 |
| Pinnacle log loss | 0.966412 |
| Bet365 log loss | 0.967769 |

**Interpretation:** Real, retrospective data were processed and scored. Differences in probability scoring are small; no hypothesis test or statistical superiority claim. Bet365 is a reference bookmaker in the source, not an assertion of available French licensed odds.

## Negative control — 2025/2026 Premier League
| Metric | Observed |
|:--|--:|
| CSV rows | 380 |
| Valid finished fixtures | 380 |
| Complete Pinnacle 1X2 triples | 210 |
| Coverage | 55.2632% |
| Dated after the API reliability cutoff | 210/210 |
| Pinnacle Brier on 210 paired rows | 0.591131 |
| Bet365 Brier on identical 210 rows | 0.588357 |
| Warning | `POST_2025_07_23_PINNACLE_STALE_WARNING` |

**Interpretation:** This is a reliability negative control, not comparable proof of bookmaker performance. Its Pinnacle prices are marked potentially outdated by the publisher. Absence and staleness must never be silently interpreted as zero or a valid bettable price.

## Claim audit
- `PASS`: public historical data retrieval, SHA-256 integrity, deterministic parser and scoring, 10 tests, clear negative controls.
- `PARTIAL`: a usable historical Pinnacle benchmark for research only.
- `UNVERIFIED`: actual API key authentication, real-time Pinnacle feed, precise quote timestamps, correctly matched French bookmaker quotes, independent BetGPT out-of-sample calibration, forward testing, CLV, ROI, and deployed live feature.
- **Not established:** profitable or actionable value bets. Market closing odds are known only retrospectively; using them to select pre-match bets would leak future information.

## Gate to any later live integration
Obtain authorised licensed timestamps and provider rights; independently verify BetGPT model on chronological holdout (no future-feature leakage); compare same fixture/market and contemporaneous quotes; reject mismatches, over-age snapshots, quota uncertainty and synthetic odds. No automatic bets; do not merge into `main` until further review and production release gate.
