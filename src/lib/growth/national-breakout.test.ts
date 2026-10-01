import assert from "node:assert/strict";
import { test } from "node:test";
import { nationalBreakoutScorecard } from "./national-breakout.ts";

test("ASTRA NATIONAL BREAKOUT prioritizes weak loops", () => {
  const report = nationalBreakoutScorecard({
    windowHours: 24,
    currentEvents: { landing: 100, return_visit: 10, chat_ask: 12, share: 2 },
    previousEvents: { landing: 120, return_visit: 12 },
    affiliateClicks: 2,
    previousAffiliateClicks: 4,
    discoverReady: 1,
    discoverCandidates: 3,
    topRoutes: [{ route: "/", n: 100 }],
  });
  assert.equal(report.status, "FIX");
  assert.equal(report.actions.length, 3);
  assert.ok(report.actions.some((a) => a.id === "discover-ready"));
  assert.ok(report.actions.some((a) => a.id === "acquisition-freshness"));
});

test("ASTRA NATIONAL BREAKOUT accelerates a healthy loop", () => {
  const report = nationalBreakoutScorecard({
    windowHours: 24,
    currentEvents: {
      landing: 100,
      return_visit: 40,
      chat_ask: 70,
      match_analyzed: 20,
      share: 20,
      chat_share: 10,
    },
    previousEvents: { landing: 60, return_visit: 20 },
    affiliateClicks: 20,
    previousAffiliateClicks: 8,
    discoverReady: 3,
    discoverCandidates: 3,
    topRoutes: [],
  });
  assert.equal(report.status, "ACCELERATE");
  assert.ok(report.score >= 70);
});
