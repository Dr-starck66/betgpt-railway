import { defineEventHandler, setHeader } from "h3";
import { loadTickets } from "../../src/engine/ticket-log";
import { publicEvidence } from "../../src/lib/geo/evidence-public";

export default defineEventHandler((event) => {
  const rows = loadTickets();
  setHeader(event, "content-type", "application/json; charset=utf-8");
  setHeader(event, "cache-control", "public, max-age=120");
  return {
    note: "Extrait du registre. Les champs absents sont null. Aucun score n’est complété.",
    count: rows.length,
    items: publicEvidence(rows),
  };
});
