# BETGPT ASTRA Ω — MASTER FINAL A→Z

This archive is the consolidated master source produced across the full BetGPT optimization session.

## Included core layers
1. Original BetGPT application source, SEO/editorial/live infrastructure.
2. Match Intelligence panel and audited confidence/calibration.
3. Accelerated learning / retrospective error learning.
4. Continuous prequential learning with champion/challenger and rollback.
5. Strict NO BET gates and minimum-odds logic.
6. ROI-first Portfolio Lab.
7. Dynamic learned minimum-odds floor.
8. Selective hedge engine.
9. Hedge scope lock: only 1-1 or 2-1 win by the team originally expected to lose (1-2 when the predicted winner is home; 2-1 when predicted winner is away).
10. Hedge profitability gate versus identical no-hedge benchmark.
11. Live Proof shadow ledger for real pre-match odds and settlement.
12. Multi-score hedge evaluation and selective policy.
13. Cross-bookmaker BEST-ODDS engine: main bet and hedge may use different bookmakers.
14. Freshness/EV/ROI fail-closed checks.
15. Evidence reports and targeted test outputs.

## Important operating rules
- No forced bet: NO BET is valid and preferred when thresholds are not met.
- Hedge is never systematic; it must improve the portfolio under the configured profitability gates.
- Cross-bookmaker selection is allowed and expected.
- Historical reconstructed correct-score odds are not a substitute for real timestamped bookmaker odds in live validation.
- Historical/simulated ROI is not a guarantee of future returns.

## Key source files to inspect first
- src/engine/match-intelligence-panel.ts
- src/engine/selective-hedge.ts
- src/engine/hedge-profitability-gate.ts
- src/engine/portfolio-lab.ts
- src/engine/best-odds-engine.ts
- scripts/run-dynamic-roi-floor.mjs

## Verification status at consolidation
The latest source carried forward the targeted verification artifacts from the session. The known full-suite baseline remained 204 PASS / 6 FAIL in pre-existing SSR/SEO tests; those failures were not represented as fixed.

## Zéro casse / URLs existantes
- `URL-PRESERVATION-AUDIT.md` — audit de préservation des routes/SEO.
- `URL-PRESERVATION-MANIFEST.json` — inventaire machine-readable des 101 routes et contrôles d'intégrité.
- `MASTER-GLOBAL-TESTS.txt` — sortie de la suite globale.
- `SESSION-HISTORY/V1-ACCELERATED-LEARNING/` — briques V1 historiques conservées sans les réactiver dans le runtime.

## V5 — XG Hedge Gate
- `XG-HEDGE-GATE-V5.md` — preuve, limites et métriques du filtre xG.
- `src/engine/xg-hedge-gate.test.ts` — tests fail-closed du filtre.

## 2026-09-27 — XG NO-BET / 0-0 RISK GATE
- Added hard `NO_BET` veto for low expected goals on both teams plus elevated 0-0 probability.
- Veto is wired into the main market decision pipeline, not only the research hedge executor.
- `NO_BET` rows are explicitly excluded from ROI-eligible simulations.
- Live exact-score cover is restricted to 1-1 or predicted-loser 2-1 and receives xG plausibility gating.
- Verification: `XG-NO-BET-GATE-V1.md`.

## 2026-09-27 — ROI5 DOMINANCE + MATURITY GATE
- Active fail-closed filter for 1X2 side bets: minimum 8-point probability dominance over the second 1X2 outcome.
- Requires at least 15 earlier settled dominance-qualified observations in the same league before a segment can place a side BET.
- Failure => `NO_BET`, stake 0, premium false, cover removed; excluded from ROI capital/P&L.
- Chronological validation slice: ROI 27.14% -> 32.23% (**+5.09 percentage points**), max drawdown 6.32 -> 3.29 units, 79 -> 57 bets.
- Full historical prequential hedged replay: 24.78% -> 35.68% (**+10.89 percentage points**).
- Historical odds are reconstructed; independent live confirmation with timestamped bookmaker prices is still required.
- Evidence: `ROI5-DOMINANCE-MATURITY-GATE-V1.md` and `data/dominance-uncertainty-gate-v1.json`.
- Reproducible command: `npm run roi5:report`.

## 2026-09-27 — ROI5 CONTINUOUS LEARNING V2
- The ROI5 dominance/maturity layer now retrains its own thresholds from newly settled, honest pre-kickoff tickets.
- Production-safe champion/challenger grid: dominance 6–14 points; maturity 10–30 prior qualified league observations.
- Candidate discovery uses the earlier 72% chronological block; promotion requires confirmation on the later 28% holdout.
- Promotion requirements: >=12 holdout selections, positive holdout ROI, >=+1.5 percentage points versus the validated default, and controlled drawdown.
- Reconstructed/closing/archive prices, post-kickoff records, future rows, and unsettled rows cannot promote production policy.
- If the challenger fails, automatic fallback/rollback keeps the validated 8-point / 15-history champion.
- New evidence: `ROI5-CONTINUOUS-LEARNING-V2.md`, `ROI5-CONTINUOUS-TARGETED-TESTS.txt`, `ROI5-CONTINUOUS-GLOBAL-TESTS.txt`.
- Targeted recheck: **60/60 PASS** across continuous ROI5, ROI5 base gate, xG/0-0, adaptive learning, continuous portfolio learning, best-odds and Match Intelligence.
- Full suite remains **204 PASS / 6 FAIL**, exactly the pre-existing local SSR/SEO 404 baseline.


## European League Expansion V1

Active ROI-positive additions: Eredivisie (ER), Primeira Liga (PT), Scottish Premiership (SC), Süper Lig (TR). They are wired into live ESPN ingestion, archive history, admin coverage, ROI5 learning and continuous learning. See `EUROPEAN-LEAGUE-EXPANSION-V1.md`. Existing routes are preserved.
