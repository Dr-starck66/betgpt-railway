# BetGPT Learning Engine V3 — Verification

- Target: >=60% settled wins, decimal odds >=1.80.
- Hard odds floor: PASS.
- Walk-forward self-result leakage test: PASS.
- Future archive leakage test: PASS.
- Historical-prior vs honest-proof separation: PASS.
- Negative-learning safety veto: PASS.
- Match Intelligence regression tests: PASS.
- Market/prono-vs-stake regression tests: PASS.
- Targeted suite: 10/10 tests PASS.
- Pipeline TypeScript syntax parse (`node --experimental-strip-types --check`): PASS.
- Full dependency-based build: NOT CERTIFIED in this workspace because node_modules is not bundled.

Current bundled evidence snapshot:
- Historical prior at odds >=1.80: 11,163 observations.
- Honest pre-kickoff walk-forward tickets: 106.
- Top trust quartile retrospective diagnostic: 18/28 = 64.29%, average odds about 2.10.
- Positive challenger: SHADOW because untouched holdout is insufficient/failed.
- Concept drift: detected.
- Immediate negative-learning AVOID segments: 3.40+ odds band, EL, OU_25_U (based on current honest ledger thresholds).

No retrospective metric is represented as a guarantee of future profitability.
