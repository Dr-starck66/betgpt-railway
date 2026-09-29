import fs from "node:fs/promises";
import { runContinuousPortfolioLearning, ROI_MIN_ODDS_GRID } from "../src/engine/continuous-portfolio-learning.ts";

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

const learning = runContinuousPortfolioLearning(tickets);
const report = {
  version: "portfolio-lab-v2-continuous-roi",
  generatedAt: new Date().toISOString(),
  mode: "RESEARCH_SHADOW_ONLY",
  objective: "maximize robust simulated ROI under prequential continuous learning",
  minOddsGrid: ROI_MIN_ODDS_GRID,
  absoluteRoiPromotionTarget: 0.13,
  learning,
  safeguards: [
    "Future outcomes never participate in policy selection.",
    "Every challenger must be ROI-positive in every chronological learning block.",
    "Champion rollback is automatic after material recent degradation.",
    "Normalized unit exposure is research-only and is not a real-money staking recommendation.",
  ],
};
await fs.writeFile(new URL("../data/continuous-portfolio-learning-report.json", import.meta.url), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
