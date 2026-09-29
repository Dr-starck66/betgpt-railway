# BetGPT — European League Expansion V1

## Active additions

The following leagues are promoted into the live BetGPT coverage and historical learning loop using the same portfolio rules as the existing competitions:

- ER — Eredivisie (ESPN `ned.1`)
- PT — Primeira Liga / Liga Portugal (ESPN `por.1`)
- SC — Scottish Premiership (ESPN `sco.1`)
- TR — Süper Lig (ESPN `tur.1`)

## Why these four

Screening used the same selection logic: 1X2 price window, low-xG/0-0 veto, ROI5 dominance+maturity gate, and the existing selective exact-score hedge policy. The research replay used OpenFootball match results and reconstructed research prices/lambdas, not timestamped historical bookmaker odds. Therefore the ROI figures are selection evidence, not a promise of future returns.

| League | Historical replay ROI | 2024-26 replay ROI | Status |
|---|---:|---:|---|
| Eredivisie | 19.72% | 12.97% | ACTIVE |
| Primeira Liga | 12.64% | 15.10% | ACTIVE |
| Scottish Premiership | 11.41% | 12.69% | ACTIVE |
| Süper Lig | 11.53% | 23.65% | ACTIVE |

Big Five replay: ~10.52% overall and ~11.14% on 2024-26. Big Five + these four: ~11.81% overall and ~12.89% on 2024-26.

## Rejected from active promotion

Belgium remained positive but diluted the combined portfolio. Austria, Greece and the tested second divisions did not satisfy the same robust promotion standard. They are not activated by this release.

## Live safety

- New leagues are fetched through ESPN live/history slugs.
- Unibet league pages are wired for listed French-market 1X2 prices.
- Existing xG/0-0 NO BET veto remains unchanged.
- ROI5 dominance/maturity and continuous champion/challenger learning apply to the new league IDs.
- Exact-score hedges remain fail-closed when timestamped listed exact-score prices are unavailable. No synthetic price is permitted in live execution.

## Zero-break rule

No existing route is removed or renamed. New leagues reuse the existing scores/match interfaces; no legacy SEO URL is replaced.
