import { defineEventHandler, setHeader } from "h3";
import { loadTickets } from "../../src/engine/ticket-log";
import { evidenceCsv } from "../../src/lib/geo/evidence-public";

export default defineEventHandler((event) => {
  setHeader(event, "content-type", "text/csv; charset=utf-8");
  setHeader(event, "content-disposition", 'attachment; filename="betgpt-evidence.csv"');
  setHeader(event, "cache-control", "public, max-age=120");
  return evidenceCsv(loadTickets());
});
