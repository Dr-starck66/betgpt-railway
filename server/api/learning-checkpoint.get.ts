import { defineEventHandler, setHeader } from "h3";
import { hydrateTickets, loadTickets } from "../../src/engine/ticket-log";
import { buildLearningMemory } from "../../src/engine/learning-memory";

export default defineEventHandler(async (event) => {
  await hydrateTickets();
  const tickets = loadTickets();
  const learning = buildLearningMemory(tickets);
  setHeader(event, "cache-control", "no-store, no-cache, must-revalidate, max-age=0");
  setHeader(event, "x-astra-checkpoint", "astra-betgpt-runtime-checkpoint/v1");
  return {
    schema: "astra-betgpt-runtime-checkpoint/v1",
    generatedAt: new Date().toISOString(),
    source: "betgpt-runtime",
    tickets,
    learning,
  };
});
