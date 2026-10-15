import { defineEventHandler, setHeader, setResponseStatus } from "h3";
import { hydrateTickets, loadTickets, syncTickets } from "../../src/engine/ticket-log";
import { buildLearningMemory } from "../../src/engine/learning-memory";
import { ensureLive, getLiveSnapshot, recoverFixtureResults } from "../../src/engine/live";
import { runEngine } from "../../src/engine/pipeline";
import { createLearningCheckpointCoordinator } from "../../src/engine/learning-refresh-coordinator";
import { planResultRecovery, type RecoveryCursor } from "./result-recovery-plan";

// A rotating cursor prevents a permanently unresolved fixture from starving
// older tickets. It remains runtime-local; no new service or persistent queue.
let recoveryCursor: RecoveryCursor = { recent: 0, historical: 0 };
async function recoverPendingResults(): Promise<{ targets: number; recovered: number }> {
  const plan = planResultRecovery(loadTickets(), Date.now(), recoveryCursor);
  recoveryCursor = plan.nextCursor;
  if (!plan.targets.length) return { targets: 0, recovered: 0 };
  // At most four requests per cycle, two provider workers and a short
  // checkpoint response budget. Settlement requires independently verified
  // final scores; unresolved tickets retain their original result=null.
  const recovered = await recoverFixtureResults(plan.targets);
  if (recovered.length) syncTickets([], recovered, []);
  return { targets: plan.targets.length, recovered: recovered.length };
}


const checkpointCoordinator = createLearningCheckpointCoordinator({
  ensureLive,
  getSnapshot: getLiveSnapshot,
  recoverPending: recoverPendingResults,
  runEngine,
});

export default defineEventHandler(async (event) => {
  await hydrateTickets();

  let cycle: Awaited<ReturnType<typeof checkpointCoordinator.refresh>>;
  try {
    cycle = await checkpointCoordinator.refresh();
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
      recovery: { status: "UNVERIFIED", targets: 0, recovered: 0 },
      tickets: [],
      learning: null,
    };
  }

  const tickets = loadTickets();
  const learning = buildLearningMemory(tickets);
  const now = Date.now();
  const upcomingPredictions = tickets.filter((row) => {
    const kickoff = Date.parse(row.kickoff);
    return row.kind === "prono" && !row.result && Number.isFinite(kickoff) && kickoff > now;
  });
  const upcomingByCompetition = Object.values(
    upcomingPredictions.reduce<Record<string, { competitionKey: string; competition: string; n: number; nextKickoff: string | null }>>((acc, row) => {
      const key = row.competitionKey ?? (row.league === "NL" ? "international.unknown" : `club:${row.league ?? "UNKNOWN"}`);
      const current = acc[key] ?? { competitionKey: key, competition: row.competition ?? row.league ?? key, n: 0, nextKickoff: null };
      current.n += 1;
      if (!current.nextKickoff || row.kickoff < current.nextKickoff) current.nextKickoff = row.kickoff;
      acc[key] = current;
      return acc;
    }, {}),
  ).sort((a, b) => (a.nextKickoff ?? "").localeCompare(b.nextKickoff ?? ""));
  const live = getLiveSnapshot();

  setHeader(event, "cache-control", "no-store, no-cache, must-revalidate, max-age=0");
  setHeader(event, "x-astra-checkpoint", "astra-betgpt-runtime-checkpoint/v2");
  return {
    schema: "astra-betgpt-runtime-checkpoint/v2",
    generatedAt: new Date().toISOString(),
    source: "betgpt-runtime",
    refresh: cycle.refresh,
    recovery: cycle.recovery,
    capture: {
      upcomingPredictions: upcomingPredictions.length,
      upcomingByCompetition,
      internationalFeed: live?.meta?.internationalFeed ?? null,
    },
    tickets,
    learning,
  };
});
