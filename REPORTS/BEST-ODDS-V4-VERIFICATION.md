# BetGPT BEST-ODDS V4 — verification

## Scope
Cross-bookmaker line shopping for the main 1X2 leg and the only authorized exact-score hedge families (1-1 or predicted-loser wins 2-1).

## Evidence
- Dedicated BEST-ODDS tests: 6/6 PASS.
- Combined hedge/learning regression suite: 34/34 PASS.
- Main and hedge can be selected from different bookmakers.
- Timestamped stale quotes are excluded after 5 minutes by default.
- Missing timestamp in live mode fails closed.
- Active dynamic odds floor is enforced before a plan can become BET.
- Positive-EV hedge is still rejected when it lowers expected portfolio ROI per unit of total capital.
- Historical/research quotes without timestamps are supported only through an explicit legacy switch.

## Connector reality
The current source has one implemented live bookmaker connector (Unibet/Kambi). The aggregator is multi-bookmaker-ready, but true multi-book line shopping is not claimed until additional real bookmaker feeds are connected. This is deliberately fail-closed rather than simulated.

## Verification limitation
`node_modules` is not present in this source workspace, so full TypeScript `npm run typecheck`, build, and the dependency-backed global suite were not re-run in this pass. No global PASS is claimed.
