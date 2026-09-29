import { readFileSync } from "node:fs";
import { join } from "node:path";
import { defineEventHandler, setHeader } from "h3";
import { buildAdaptiveLearningReport } from "../../src/engine/adaptive-learning";
import { loadTickets, type TicketRow } from "../../src/engine/ticket-log";

function archiveTickets(): TicketRow[] {
  try {
    const raw = JSON.parse(readFileSync(join(process.cwd(), "data", "archive-backtest.json"), "utf8"));
    return Array.isArray(raw?.tickets) ? raw.tickets : [];
  } catch {
    return [];
  }
}

export default defineEventHandler((event) => {
  setHeader(event, "content-type", "application/json; charset=utf-8");
  setHeader(event, "cache-control", "public, max-age=120");
  return buildAdaptiveLearningReport(loadTickets(), archiveTickets());
});
