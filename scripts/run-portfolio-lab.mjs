import fs from "node:fs/promises";
import { discoverPortfolioPolicies } from "../src/engine/portfolio-lab.ts";

const raw = JSON.parse(await fs.readFile(new URL("../data/archive-backtest.json", import.meta.url), "utf8"));
const tickets = raw.tickets
  .filter((t) => (t.market === "1X2_H" || t.market === "1X2_A") && (t.result === "win" || t.result === "lose"))
  .map((t) => ({
    kickoff: String(t.kickoff),
    league: String(t.league),
    market: t.market,
    odds: Number(t.odds),
    modelProb: Number(t.modelProb),
    result: t.result,
  }));

const discovery = discoverPortfolioPolicies(tickets);
const report = {
  version: "portfolio-lab-v1",
  generatedAt: new Date().toISOString(),
  mode: "RESEARCH_SHADOW_ONLY",
  objective: {
    minMainOdds: 1.8,
    accuracyTarget: 0.6,
    optimize: ["holdout_roi", "holdout_profit", "max_drawdown", "stability"],
    note: "Normalized research exposure is not a real-money staking recommendation.",
  },
  discovery,
  warnings: [
    "Historical bookmaker/exact-score pricing is incomplete or partly synthetic.",
    "Holdout performance is historical evidence, not a guarantee of future profitability.",
    "Any live promotion must use timestamped real bookmaker prices collected before kickoff.",
  ],
};
await fs.writeFile(new URL("../data/portfolio-lab-report.json", import.meta.url), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
