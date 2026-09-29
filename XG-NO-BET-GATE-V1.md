# BetGPT — XG NO-BET / 0-0 Risk Gate V1

Date: 2026-09-27
Status: implemented in the production decision pipeline and in the selective score-hedge logic.

## Invariant

If both teams have weak pre-match scoring expectation and the estimated 0-0 risk is elevated, BetGPT must not place a wager.

Default conservative gate:
- home expected goals <= 1.10;
- away expected goals <= 1.10;
- total expected goals <= 2.10;
- estimated P(0-0) >= 12%.

All conditions are required for the hard low-xG veto. If an explicit 0-0 probability is available it is used; otherwise the gate derives a Poisson fallback `exp(-(home + away))`.

## Runtime effect

When the gate triggers:
- every market is forced to `NO_BET`;
- stake is forced to 0;
- premium status is removed;
- no score hedge is emitted;
- the match cannot become Daily Best because no market remains `BET`;
- `NO_BET` records are explicitly excluded from ROI-eligible simulations/accounting.

## Hedge xG filter

Displayed/research exact-score cover is now restricted to the same two hedge families:
- 1-1;
- predicted losing side wins 2-1 (`1-2` after a home pick, `2-1` after an away pick).

Additional scoring plausibility filters apply before exact-score EV is considered. Real listed bookmaker odds remain mandatory in the selective score-hedge engine.

## Verification

- XG gate suite: 23/23 PASS.
- Existing hedge/learning/best-odds/Match Intelligence suites rerun: 50/50 PASS in their latest executions.
- Full repository suite: 204/210 PASS; the same 6 known `raw HTML SSR SEO` checks return 404 in this local environment (robots, sitemap, raw match HTML, `/prono` redirect, noindex raw HTML, SEO hub raw HTML). No new xG/hedge test failure is present.

## Evidence limitation

The historical archive available in this source tree does not contain timestamped provider-observed xG for the full sample. Therefore this implementation does **not** claim a measured historical ROI uplift from true provider xG. The rule is implemented as a risk-control invariant; future timestamped observed-xG outcomes can re-estimate the configurable thresholds without changing the invariant.
