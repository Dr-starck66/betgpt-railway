import assert from "node:assert/strict";
import test from "node:test";
import { chronologicalSplit, discoverPortfolioPolicies, portfolioMetrics, ruleMatches, type PortfolioTicket } from "./portfolio-lab.ts";

test("portfolioMetrics computes flat ROI and drawdown", () => {
  const x: PortfolioTicket[] = [
    { kickoff: "2026-01-01", league: "PL", market: "1X2_H", odds: 2, modelProb: 0.5, result: "win" },
    { kickoff: "2026-01-02", league: "PL", market: "1X2_H", odds: 2, modelProb: 0.5, result: "lose" },
    { kickoff: "2026-01-03", league: "PL", market: "1X2_H", odds: 2, modelProb: 0.5, result: "win" },
  ];
  const m = portfolioMetrics(x);
  assert.equal(m.n, 3);
  assert.equal(m.wins, 2);
  assert.ok(Math.abs(m.roi - 1 / 3) < 1e-9);
  assert.equal(m.maxDrawdown, 1);
});

test("chronologicalSplit never randomizes the holdout", () => {
  const x: PortfolioTicket[] = Array.from({ length: 10 }, (_, i) => ({
    kickoff: `2026-01-${String(10 - i).padStart(2, "0")}`,
    league: "PL",
    market: "1X2_H",
    odds: 1.9,
    modelProb: 0.6,
    result: "win",
  }));
  const s = chronologicalSplit(x);
  assert.equal(s.train[0]!.kickoff, "2026-01-01");
  assert.equal(s.holdout.at(-1)!.kickoff, "2026-01-10");
});

test("ruleMatches enforces odds, market, league and model probability", () => {
  const t: PortfolioTicket = { kickoff: "2026-01-01", league: "LL", market: "1X2_A", odds: 1.9, modelProb: 0.45, result: "win" };
  assert.equal(ruleMatches(t, { id: "x", market: "1X2_A", minOdds: 1.8, maxOdds: 2, minModelProb: 0.4, league: "LL" }), true);
  assert.equal(ruleMatches(t, { id: "x", market: "1X2_H", minOdds: 1.8, maxOdds: 2, minModelProb: 0.4, league: "LL" }), false);
});

test("discovery keeps policies shadow-gated when holdout collapses", () => {
  const x: PortfolioTicket[] = [];
  for (let i = 0; i < 1000; i++) {
    const late = i >= 800;
    x.push({
      kickoff: new Date(Date.UTC(2020, 0, 1 + i)).toISOString(),
      league: "PL",
      market: "1X2_H",
      odds: 1.9,
      modelProb: 0.6,
      result: late ? "lose" : i % 4 === 0 ? "lose" : "win",
    });
  }
  const d = discoverPortfolioPolicies(x);
  assert.equal(d.gates.accuracyPass, false);
  assert.equal(d.gates.hybridPass, false);
});
