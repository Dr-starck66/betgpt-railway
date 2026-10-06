import { buildAdaptiveLearningReport } from "./adaptive-learning.ts";
import { calculateLedgerStats } from "./ledger-stats.ts";
import { fixtureKey, isCanonicalRoi5Selection } from "./ledger-pick.ts";
import { learnContinuousRoi5Policy } from "./roi5-continuous-learning.ts";
import { oddsPlayable } from "@/lib/markets";
import { writePersist } from "@/lib/persist";
import { kvSet } from "@/lib/store";
import type { TicketRow } from "./ticket-log.ts";

export const LEARNING_MEMORY_KEY = "betgpt:learning-memory:v1";

export type FactorPerformance = {
  factor: string;
  n: number;
  wins: number;
  losses: number;
  hitRate: number;
  roi: number;
  profitUnits: number;
};

export type LearningMemorySnapshot = {
  schema: "astra-betgpt-learning-memory/v1";
  generatedAt: string;
  canonicalScope: "1X2_HOME_AWAY_1.80_3.00";
  canonicalSettledN: number;
  canonicalWins: number;
  canonicalLosses: number;
  canonicalRoi: number | null;
  learningSettledN: number;
  learningWins: number;
  learningLosses: number;
  learningSimulatedRoi: number | null;
  learningFreshness: {
    latestSettledKickoff: string | null;
    settledLast24h: number;
    settledLast7d: number;
    status: "FRESH" | "STALE" | "EMPTY";
  };
  ledger: ReturnType<typeof calculateLedgerStats>;
  roi5: ReturnType<typeof learnContinuousRoi5Policy>;
  adaptive: ReturnType<typeof buildAdaptiveLearningReport>;
  factorPerformance: FactorPerformance[];
  harmfulFactors: FactorPerformance[];
  helpfulFactors: FactorPerformance[];
  latestSettled: Array<{
    id: string;
    kickoff: string;
    league: string;
    market: string;
    odds: number;
    result: "win" | "lose";
    pnlUnits: number;
    kind: "mise" | "prono";
    decision: string;
    evidence: "ACTUAL_BET" | "OBSERVATIONAL_PREDICTION";
    factors: string[];
  }>;
};

function honestSettledObservation(row: TicketRow): row is TicketRow & { result: "win" | "lose" } {
  if (row.result !== "win" && row.result !== "lose") return false;
  if (row.market !== "1X2_H" && row.market !== "1X2_A") return false;
  if (!oddsPlayable(row.odds)) return false;
  if (/cl[oô]ture|d[eé]riv[eé]|archive/i.test(row.book || "")) return false;
  const recorded = Date.parse(row.recordedAt);
  const kickoff = Date.parse(row.kickoff);
  return Number.isFinite(recorded) && Number.isFinite(kickoff) && recorded < kickoff;
}

function honestSettledBet(row: TicketRow): row is TicketRow & { result: "win" | "lose" } {
  return honestSettledObservation(row) && row.kind === "mise" && isCanonicalRoi5Selection(row);
}

function learningRowsOf(rows: TicketRow[]): Array<TicketRow & { result: "win" | "lose" }> {
  const byFixtureMarket = new Map<string, TicketRow & { result: "win" | "lose" }>();
  for (const row of rows.filter(honestSettledObservation).sort((a, b) => a.kickoff.localeCompare(b.kickoff))) {
    const key = `${fixtureKey(row.home, row.away, row.kickoff)}|${row.market}`;
    const prev = byFixtureMarket.get(key);
    if (!prev) {
      byFixtureMarket.set(key, row);
      continue;
    }
    const preferMise = prev.kind !== "mise" && row.kind === "mise";
    const sameKindLater =
      prev.kind === row.kind && Date.parse(row.recordedAt) > Date.parse(prev.recordedAt);
    if (preferMise || sameKindLater) byFixtureMarket.set(key, row);
  }
  return [...byFixtureMarket.values()].sort((a, b) => a.kickoff.localeCompare(b.kickoff));
}

function bucket(value: number, cuts: number[], labels: string[]): string {
  for (let i = 0; i < cuts.length; i += 1) {
    if (value < cuts[i]!) return labels[i]!;
  }
  return labels[labels.length - 1]!;
}

function oddsBucket(odds: number): string {
  return bucket(odds, [2.1, 2.4, 2.7], ["1.80-2.09", "2.10-2.39", "2.40-2.69", "2.70-3.00"]);
}

function probBucket(prob: number): string {
  return bucket(prob, [0.42, 0.48, 0.54], ["<42%", "42-47%", "48-53%", "54%+"]);
}

function evBucket(ev: number): string {
  return bucket(ev, [0.03, 0.07, 0.12], ["<3%", "3-6%", "7-11%", "12%+"]);
}

function qualityBucket(v: number): string {
  return bucket(v, [0.55, 0.72, 0.86], ["LOW", "MEDIUM", "GOOD", "HIGH"]);
}

function disagreementBucket(v: number): string {
  return bucket(v, [0.06, 0.12, 0.2], ["LOW", "MEDIUM", "HIGH", "VERY_HIGH"]);
}

function signedBucket(v: number): string {
  if (v <= -0.05) return "AGAINST_STRONG";
  if (v <= -0.015) return "AGAINST";
  if (v >= 0.05) return "WITH_STRONG";
  if (v >= 0.015) return "WITH";
  return "FLAT";
}

export function factorsOf(row: TicketRow): string[] {
  const c = row.learningContext;
  const factors = [
    `market:${row.market}`,
    `league:${row.league ?? "UNKNOWN"}`,
    `odds:${oddsBucket(row.odds)}`,
    `prob:${probBucket(row.modelProb)}`,
    `ev:${evBucket(row.ev)}`,
  ];
  if (!c) return factors;

  factors.push(
    `dataQuality:${qualityBucket(c.dataQuality)}`,
    `modelDisagreement:${disagreementBucket(c.modelDisagreement)}`,
    `tacticalConflict:${disagreementBucket(c.tacticalConflict)}`,
    `devilChallenge:${disagreementBucket(c.devilChallenge)}`,
    `oddsMove:${signedBucket(c.oddsMove)}`,
  );

  if (c.absenceHomeImpact >= 0.8) factors.push("absenceHome:HIGH");
  if (c.absenceAwayImpact >= 0.8) factors.push("absenceAway:HIGH");
  if (Math.abs(c.restDiffDays) >= 2) factors.push(`restEdge:${c.restDiffDays > 0 ? "HOME" : "AWAY"}`);
  if (c.congestionDiff >= 1) factors.push("congestionEdge:HOME");
  if (c.congestionDiff <= -1) factors.push("congestionEdge:AWAY");
  if (c.travelAwayKm >= 900) factors.push("awayTravel:HIGH");
  if (c.importance >= 0.8) factors.push("importance:HIGH");
  if (c.missingInformationCount >= 3) factors.push("missingInfo:HIGH");
  if (c.availableInformationCount >= 8) factors.push("infoCoverage:HIGH");
  return [...new Set(factors)];
}

function aggregateFactors(rows: Array<TicketRow & { result: "win" | "lose" }>): FactorPerformance[] {
  const map = new Map<string, { n: number; wins: number; returned: number }>();
  for (const row of rows) {
    for (const factor of factorsOf(row)) {
      const s = map.get(factor) ?? { n: 0, wins: 0, returned: 0 };
      s.n += 1;
      if (row.result === "win") {
        s.wins += 1;
        s.returned += row.odds;
      }
      map.set(factor, s);
    }
  }
  return [...map.entries()]
    .map(([factor, s]) => ({
      factor,
      n: s.n,
      wins: s.wins,
      losses: s.n - s.wins,
      hitRate: s.n ? s.wins / s.n : 0,
      roi: s.n ? (s.returned - s.n) / s.n : 0,
      profitUnits: s.returned - s.n,
    }))
    .sort((a, b) => b.n - a.n || b.roi - a.roi);
}

export function buildLearningMemory(
  rows: TicketRow[],
  generatedAt = new Date().toISOString(),
): LearningMemorySnapshot {
  const learningRows = learningRowsOf(rows);
  const canonical = learningRows.filter(honestSettledBet);
  const factorPerformance = aggregateFactors(learningRows);
  const ledger = calculateLedgerStats(rows);
  const roi5 = learnContinuousRoi5Policy(rows, generatedAt);
  const adaptive = buildAdaptiveLearningReport(learningRows, []);

  const returned = canonical.reduce((sum, row) => sum + (row.result === "win" ? row.odds : 0), 0);
  const canonicalRoi = canonical.length ? (returned - canonical.length) / canonical.length : null;
  const canonicalWins = canonical.filter((row) => row.result === "win").length;
  const learningReturned = learningRows.reduce((sum, row) => sum + (row.result === "win" ? row.odds : 0), 0);
  const learningWins = learningRows.filter((row) => row.result === "win").length;
  const learningSimulatedRoi = learningRows.length
    ? (learningReturned - learningRows.length) / learningRows.length
    : null;
  const generatedMs = Date.parse(generatedAt);
  const nowMs = Number.isFinite(generatedMs) ? generatedMs : Date.now();
  const settledLast24h = learningRows.filter((row) => nowMs - Date.parse(row.kickoff) <= 24 * 3600_000).length;
  const settledLast7d = learningRows.filter((row) => nowMs - Date.parse(row.kickoff) <= 7 * 24 * 3600_000).length;
  const latestSettledKickoff = learningRows.length ? learningRows[learningRows.length - 1]!.kickoff : null;
  const latestMs = latestSettledKickoff ? Date.parse(latestSettledKickoff) : NaN;
  const learningFreshness = {
    latestSettledKickoff,
    settledLast24h,
    settledLast7d,
    status: !latestSettledKickoff
      ? ("EMPTY" as const)
      : Number.isFinite(latestMs) && nowMs - latestMs <= 7 * 24 * 3600_000
        ? ("FRESH" as const)
        : ("STALE" as const),
  };

  const mature = factorPerformance.filter((f) => f.n >= 3);
  const harmfulFactors = [...mature].sort((a, b) => a.roi - b.roi || b.n - a.n).slice(0, 12);
  const helpfulFactors = [...mature].sort((a, b) => b.roi - a.roi || b.n - a.n).slice(0, 12);
  const latestSettled = [...learningRows]
    .sort((a, b) => b.kickoff.localeCompare(a.kickoff))
    .slice(0, 25)
    .map((row) => ({
      id: row.id,
      kickoff: row.kickoff,
      league: row.league ?? "UNKNOWN",
      market: row.market,
      odds: row.odds,
      result: row.result,
      pnlUnits: row.result === "win" ? row.odds - 1 : -1,
      kind: row.kind,
      decision: row.decision,
      evidence: row.kind === "mise" && row.decision === "BET" ? "ACTUAL_BET" : "OBSERVATIONAL_PREDICTION",
      factors: factorsOf(row),
    }));

  return {
    schema: "astra-betgpt-learning-memory/v1",
    generatedAt,
    canonicalScope: "1X2_HOME_AWAY_1.80_3.00",
    canonicalSettledN: canonical.length,
    canonicalWins,
    canonicalLosses: canonical.length - canonicalWins,
    canonicalRoi,
    learningSettledN: learningRows.length,
    learningWins,
    learningLosses: learningRows.length - learningWins,
    learningSimulatedRoi,
    learningFreshness,
    ledger,
    roi5,
    adaptive,
    factorPerformance,
    harmfulFactors,
    helpfulFactors,
    latestSettled,
  };
}

export async function persistLearningMemory(rows: TicketRow[]): Promise<LearningMemorySnapshot> {
  const snapshot = buildLearningMemory(rows);
  writePersist("learning-memory.json", JSON.stringify(snapshot, null, 2));
  await kvSet(LEARNING_MEMORY_KEY, snapshot);
  return snapshot;
}
