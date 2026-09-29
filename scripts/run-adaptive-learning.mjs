import { readFileSync, writeFileSync } from "node:fs";
import { buildAdaptiveLearningReport } from "../src/engine/adaptive-learning.ts";

const tickets = JSON.parse(readFileSync(new URL("../data/tickets.json", import.meta.url), "utf8"));
const archive = JSON.parse(readFileSync(new URL("../data/archive-backtest.json", import.meta.url), "utf8"));
const report = buildAdaptiveLearningReport(tickets, Array.isArray(archive?.tickets) ? archive.tickets : []);
writeFileSync(new URL("../data/adaptive-learning-report.json", import.meta.url), JSON.stringify({ generatedAt: new Date().toISOString(), ...report }, null, 2));
console.log(JSON.stringify(report, null, 2));
