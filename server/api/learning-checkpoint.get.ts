import { defineEventHandler, setHeader, setResponseStatus } from "h3";
import { hydrateTickets, loadTickets } from "../../src/engine/ticket-log";
import { buildLearningMemory } from "../../src/engine/learning-memory";
import { ensureLive, getLiveSnapshot } from "../../src/engine/live";
import { runEngine } from "../../src/engine/pipeline";

const REFRESH_TIMEOUT_MS = 18_000;

async function refreshBeforeCheckpoint(): Promise<void> {
  await Promise.race([
    ensureLive().then(() => undefined),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("ASTRA_LEARNING_REFRESH_TIMEOUT")), REFRESH_TIMEOUT_MS),
    ),
  ]);
  // runEngine() synchronously settles tickets against the refreshed live/history
  // snapshot through syncTickets() before the checkpoint reads the ledger.
  runEngine();
}

export default defineEventHandler(async (event) => {
  await hydrateTickets();

  try {
    await refreshBeforeCheckpoint();
  } catch (error) {
    setResponseStatus(event, 503);
    setHeader(event, "cache-control", "no-store, no-cache, must-revalidate, max-age=0");
    setHeader(event, "x-astra-checkpoint", "astra-betgpt-runtime-checkpoint/v2");
    return {
      schema: "astra-betgpt-runtime-checkpoint/v2",
      generatedAt: new Date().toISOString(),
      source: "betgpt-runtime",
      refresh: {
        status: "FAIL",
        error: error instanceof Error ? error.message : String(error),
      },
      tickets: [],
      learning: null,
    };
  }

  const tickets = loadTickets();
  const learning = buildLearningMemory(tickets);
  const live = getLiveSnapshot();

  setHeader(event, "cache-control", "no-store, no-cache, must-revalidate, max-age=0");
  setHeader(event, "x-astra-checkpoint", "astra-betgpt-runtime-checkpoint/v2");
  return {
    schema: "astra-betgpt-runtime-checkpoint/v2",
    generatedAt: new Date().toISOString(),
    source: "betgpt-runtime",
    refresh: {
      status: "PASS",
      liveFetchedAt: live?.fetchedAt ?? null,
      liveAsOf: live?.meta?.asOf ?? null,
    },
    tickets,
    learning,
  };
});
