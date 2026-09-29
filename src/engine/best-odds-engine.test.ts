import assert from "node:assert/strict";
import test from "node:test";
import type { BookOdds } from "./types.ts";
import { buildCrossBookExecutionPlan, bestFreshMainQuote, freshBookSnapshots } from "./best-odds-engine.ts";
import { DEFAULT_SCORE_HEDGE_POLICY } from "./selective-score-hedge.ts";

const now = Date.parse("2026-09-27T00:45:00+02:00");
function b(book: string, home: number, away: number, observedAt: string, cs: Record<string, number> = {}): BookOdds {
  return { book, home, draw: 3.4, away, over15: 0, over25: 0, over35: 0, under25: 0, bttsYes: 0, bttsNo: 0, observedAt, cs };
}

const activeHedge = {
  ...DEFAULT_SCORE_HEDGE_POLICY,
  status: "ACTIVE" as const,
  minExactScoreEv: 0,
  maxHedgeStakeFraction: 0.2,
  segments: {
    ...DEFAULT_SCORE_HEDGE_POLICY.segments,
    draw11: { ...DEFAULT_SCORE_HEDGE_POLICY.segments.draw11, allowedLeagues: ["LL" as const], recoveryFraction: 0.5 },
    opponent21: { ...DEFAULT_SCORE_HEDGE_POLICY.segments.opponent21, allowedLeagues: ["LL" as const], recoveryFraction: 0.5 },
  },
};

test("freshness rejects stale bookmakers when timestamps are present", () => {
  const books = [
    b("Fresh", 2.05, 3, "2026-09-27T00:43:00+02:00"),
    b("Stale", 2.50, 3, "2026-09-27T00:30:00+02:00"),
  ];
  assert.deepEqual(freshBookSnapshots(books, now, 5 * 60_000, true).map((x) => x.book), ["Fresh"]);
  assert.equal(bestFreshMainQuote(books, "1X2_H", { nowMs: now })?.book, "Fresh");
});

test("main and hedge may come from different bookmakers", () => {
  const books = [
    b("Betclic", 2.20, 3.2, "2026-09-27T00:43:00+02:00", { "1-1": 7.0, "1-2": 9.0 }),
    b("Winamax", 2.14, 3.3, "2026-09-27T00:44:00+02:00", { "1-1": 12.0, "1-2": 13.0 }),
  ];
  const plan = buildCrossBookExecutionPlan({
    books, league: "LL", market: "1X2_H", mainModelProb: 0.46, mainStake: 1,
    p11: 0.12, pOpponent21: 0.09, nowMs: now,
    hedgePolicy: activeHedge,
    oddsPolicy: { minMainOdds: 2.0, minPortfolioRoiUplift: -1 },
  });
  assert.equal(plan.status, "BET");
  assert.equal(plan.main?.book, "Betclic");
  assert.equal(plan.hedgeBook, "Winamax");
  assert.equal(plan.crossBook, true);
});

test("active odds floor is strict", () => {
  const books = [b("Book", 2.18, 3.2, "2026-09-27T00:44:00+02:00")];
  const plan = buildCrossBookExecutionPlan({
    books, league: "LL", market: "1X2_H", mainModelProb: 0.55, mainStake: 1,
    p11: 0.1, pOpponent21: 0.05, nowMs: now, oddsPolicy: { minMainOdds: 2.2 },
  });
  assert.equal(plan.status, "NO_BET");
  assert.equal(plan.reason, "MAIN_BELOW_ACTIVE_ODDS_FLOOR");
});

test("missing fresh timestamp fails closed in live mode", () => {
  const book = { ...b("Legacy", 2.2, 3, "2026-09-27T00:44:00+02:00"), observedAt: undefined };
  const plan = buildCrossBookExecutionPlan({
    books: [book], league: "LL", market: "1X2_H", mainModelProb: 0.55, mainStake: 1,
    p11: 0.1, pOpponent21: 0.05, nowMs: now,
  });
  assert.equal(plan.status, "NO_BET");
  assert.equal(plan.reason, "NO_FRESH_LISTED_MAIN_QUOTE");
});

test("ROI-first gate removes a hedge that dilutes portfolio ROI", () => {
  const books = [
    b("A", 2.3, 3.2, "2026-09-27T00:44:00+02:00", { "1-1": 10.0, "1-2": 12.0 }),
  ];
  const plan = buildCrossBookExecutionPlan({
    books, league: "LL", market: "1X2_H", mainModelProb: 0.46, mainStake: 1,
    p11: 0.102, pOpponent21: 0.085, nowMs: now,
    hedgePolicy: activeHedge,
    oddsPolicy: { minMainOdds: 2.0, minPortfolioRoiUplift: 0 },
  });
  assert.equal(plan.status, "BET");
  assert.equal(plan.hedgeDecision?.selected, null);
  assert.equal(plan.hedgeDecision?.reason, "HEDGE_DILUTES_EXPECTED_PORTFOLIO_ROI");
  assert.equal(plan.combinedExpectedRoi, plan.mainExpectedRoi);
});

test("legacy research snapshots can be explicitly allowed", () => {
  const book = { ...b("Legacy", 2.25, 3, "2026-09-27T00:44:00+02:00"), observedAt: undefined };
  const q = bestFreshMainQuote([book], "1X2_H", { nowMs: now, requireTimestamp: false });
  assert.equal(q?.book, "Legacy");
  assert.equal(q?.odds, 2.25);
});

test('xG scoring context can remove an implausible opponent 2-1 hedge without cancelling the main bet', () => {
  const now2 = Date.parse('2026-09-27T12:00:00Z');
  const books = [b('A', 2.2, 3.0, '2026-09-27T11:59:00Z', { '1-1': 6, '1-2': 15 })];
  const plan = buildCrossBookExecutionPlan({ books, league: 'LL', market: '1X2_H', mainModelProb: .5, mainStake: 1, p11: .04, pOpponent21: .08, nowMs: now2, hedgePolicy: activeHedge, scoringContext: { source: 'OBSERVED_XG', expectedHomeGoals: 1.45, expectedAwayGoals: .65, bttsProb: .34, over25Prob: .27 } });
  assert.equal(plan.status, 'BET');
  assert.equal(plan.hedgeDecision?.selected, null);
});

test("low xG plus elevated 0-0 risk hard-vetoes the main bet and commits zero capital", () => {
  const now = Date.parse("2026-09-27T10:00:00Z");
  const books = [{ book: "A", home: 2.2, draw: 3.1, away: 3.3, observedAt: "2026-09-27T09:59:00Z" }];
  const plan = buildCrossBookExecutionPlan({
    books,
    league: "LL",
    market: "1X2_H",
    mainModelProb: 0.5,
    mainStake: 1,
    p11: 0.15,
    pOpponent21: 0.06,
    nowMs: now,
    scoringContext: {
      source: "OBSERVED_XG",
      expectedHomeGoals: 0.9,
      expectedAwayGoals: 0.85,
      zeroZeroProb: 0.18,
      bttsProb: 0.34,
      over25Prob: 0.26,
    },
  });
  assert.equal(plan.status, "NO_BET");
  assert.equal(plan.reason, "LOW_XG_00_RISK_NO_BET");
  assert.equal(plan.totalCapital, 0);
  assert.equal(plan.mainExpectedPnl, 0);
  assert.equal(plan.combinedExpectedPnl, 0);
});
