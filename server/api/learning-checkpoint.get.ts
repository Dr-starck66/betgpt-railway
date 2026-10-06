import { defineEventHandler, setHeader, setResponseStatus } from "h3";
import { hydrateTickets, loadTickets, syncTickets } from "../../src/engine/ticket-log";
import { buildLearningMemory } from "../../src/engine/learning-memory";
import { ensureLive, getLiveSnapshot, recoverEspnResults } from "../../src/engine/live";
import { runEngine } from "../../src/engine/pipeline";

const REFRESH_TIMEOUT_MS = 18_000;

function timeout<T>(promise: Promise<T>, ms: number, code: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(code)), ms)),
  ]);
}

async function recoverPendingResults(): Promise<{ targets: number; recovered: number }> {
  const now = Date.now();
  const seen = new Set<string>();
  const targets = loadTickets()
    .filter((row) => {
      if (row.result || !/^espn-\d{5,12}$/i.test(row.matchId)) return false;
      const kickoff = Date.parse(row.kickoff);
      return Number.isFinite(kickoff) && kickoff <= now - 90 * 60_000 && now - kickoff <= 8 * 864e5;
    })
    .filter((row) => {
      if (seen.has(row.matchId)) return false;
      seen.add(row.matchId);
      return true;
    })
    .map((row) => ({ matchId: row.matchId, kickoff: row.kickoff, league: row.league }));

  if (!targets.length) return { targets: 0, recovered: 0 };
  const recovered = await timeout(
    recoverEspnResults(targets),
    14_000,
    "ASTRA_RESULT_RECOVERY_TIMEOUT",
  );
  if (recovered.length) syncTickets([], recovered, []);
  return { targets: targets.length, recovered: recovered.length };
}

async function refreshBeforeCheckpoint(): Promise<{ targets: number; recovered: number }> {
  const [, recovery] = await Promise.all([
    timeout(ensureLive().then(() => undefined), REFRESH_TIMEOUT_MS, "ASTRA_LEARNING_REFRESH_TIMEOUT"),
    recoverPendingResults(),
  ]);
  // runEngine() synchronously settles tickets against the refreshed live/history
  // snapshot through syncTickets() before the checkpoint reads the ledger.
  runEngine();
  return recovery;
}

export default defineEventHandler(async (event) => {
  await hydrateTickets();

  let recovery = { targets: 0, recovered: 0 };
  try {
    recovery = await refreshBeforeCheckpoint();
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
      recovery,
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
    recovery,
    tickets,
    learning,
  };
});
