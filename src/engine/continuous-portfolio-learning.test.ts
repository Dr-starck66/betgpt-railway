import assert from "node:assert/strict";
import test from "node:test";
import {
  discoverRoiChallenger,
  runContinuousPortfolioLearning,
  type ContinuousLearningConfig,
} from "./continuous-portfolio-learning.ts";
import type { PortfolioTicket } from "./portfolio-lab.ts";

const testConfig: ContinuousLearningConfig = {
  minOdds: 1.8,
  maxOdds: 3,
  historyWindow: 800,
  warmup: 400,
  retrainEvery: 100,
  blocks: 4,
  minBlockN: 8,
  minTotalN: 40,
  minRoiLift: 0.01,
  maxDrawdownMultiplier: 1.3,
};

function ticket(i: number, result: "win" | "lose", market: "1X2_H" | "1X2_A" = "1X2_A", odds = 2.1): PortfolioTicket {
  return {
    kickoff: new Date(Date.UTC(2020, 0, 1 + i)).toISOString(),
    league: "PL",
    market,
    odds,
    modelProb: 0.5,
    result,
  };
}

test("ROI challenger requires positive performance in every chronological learning block", () => {
  const rows: PortfolioTicket[] = [];
  for (let i = 0; i < 400; i++) rows.push(ticket(i, i % 3 === 0 ? "lose" : "win"));
  const c = discoverRoiChallenger(rows, testConfig);
  assert.ok(c);
  assert.ok(c!.blockRois.every((x) => x > 0));
  assert.ok(c!.totalN >= testConfig.minTotalN);
});

test("continuous learner is prequential: late collapse cannot rewrite earlier policy selection", () => {
  const good: PortfolioTicket[] = [];
  for (let i = 0; i < 600; i++) good.push(ticket(i, i % 3 === 0 ? "lose" : "win"));
  const first = runContinuousPortfolioLearning(good, testConfig);

  const withLateCollapse = [...good];
  for (let i = 600; i < 800; i++) withLateCollapse.push(ticket(i, "lose"));
  const second = runContinuousPortfolioLearning(withLateCollapse, testConfig);

  assert.deepEqual(second.decisions.slice(0, first.decisions.length).map((d) => d.challenger), first.decisions.map((d) => d.challenger));
});

test("learner can roll back a champion after recent drift", () => {
  const rows: PortfolioTicket[] = [];
  for (let i = 0; i < 600; i++) rows.push(ticket(i, i % 4 === 0 ? "lose" : "win"));
  for (let i = 600; i < 900; i++) rows.push(ticket(i, "lose"));
  const report = runContinuousPortfolioLearning(rows, testConfig);
  assert.ok(report.rollbacks >= 0);
  assert.equal(report.mode, "PREQUENTIAL_RESEARCH_SHADOW");
});

test("reported ROI is based only on post-learning evaluation blocks", () => {
  const rows: PortfolioTicket[] = [];
  for (let i = 0; i < 900; i++) rows.push(ticket(i, i % 3 === 0 ? "lose" : "win"));
  const report = runContinuousPortfolioLearning(rows, testConfig);
  assert.ok(report.baseline.n <= rows.length - testConfig.warmup);
  assert.ok(Number.isFinite(report.roiLift));
});
