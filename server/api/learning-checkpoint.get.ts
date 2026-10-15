import { defineEventHandler, setHeader, setResponseStatus } from "h3";
import { hydrateTickets, loadTickets, syncTickets } from "../../src/engine/ticket-log";
import { buildLearningMemory } from "../../src/engine/learning-memory";
import { ensureLive, getLiveSnapshot, recoverFixtureResults } from "../../src/engine/live";
import { runEngine } from "../../src/engine/pipeline";
import { createLearningCheckpointCoordinator } from "../../src/engine/learning-refresh-coordinator";

async function recoverPendingResults(): Promise<{ targets: number; recovered: number }> {
  const now = Date.now();
  const seen = new Set<string>();
  const targets = loadTickets()
    .filter((row) => {
      if (row.result) return false;
      const kickoff = Date.parse(row.kickoff);
      return Number.isFinite(kickoff) && kickoff <= now - 90 * 60_000 && now - kickoff <= 8 * 864e5;
    })
    .filter((row) => {
      if (seen.has(row.matchId)) return false;
      seen.add(row.matchId);
      return true;
    })
    .map((row) => ({ matchId: row.matchId, kickoff: row.kickoff, league: row.league, home: row.home, away: row.away, competition: row.competition, competitionKey: row.competitionKey }));

  if (!targets.length) return { targets: 0, recovered: 0 };
  // Runs under a single-flight, three-second response budget. Let bounded
  // provider retries complete in the background rather than failing the
  // entire fresh learning checkpoint after a slow historical fixture.
  const recovered = await recoverFixtureResults(targets);
  if (recovered.length) syncTickets([], recovered, []);
  return { targets: targets.length, recovered: recovered.length };
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
