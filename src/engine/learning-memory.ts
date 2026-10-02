import { buildAdaptiveLearningReport } from "./adaptive-learning.ts";
import { calculateLedgerStats } from "./ledger-stats.ts";
import { isCanonicalRoi5Selection } from "./ledger-pick.ts";
import { learnContinuousRoi5Policy } from "./roi5-continuous-learning.ts";
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
    factors: string[];
  }>;
};

function honestSettled(row: TicketRow): row is TicketRow & { result: "win" | "lose" } {
  if (row.result !== "win" && row.result !== "lose") return false;
  if (!isCanonicalRoi5Selection(row)) return false;
  if (row.kind !== "mise") return false;
  if (/cl[oô]ture|d[eé]riv[eé]|archive/i.test(row.book || "")) return false;
  const recorded = Date.parse(row.recordedAt);
  const kickoff = Date.parse(row.kickoff);
  return Number.isFinite(recorded) && Number.isFinite(kickoff) && recorded < kickoff;
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
  const canonical = rows.filter(honestSettled);
  const factorPerformance = aggregateFactors(canonical);
  const ledger = calculateLedgerStats(rows);
  const roi5 = learnContinuousRoi5Policy(rows, generatedAt);
  const adaptive = buildAdaptiveLearningReport(rows, []);

  const returned = canonical.reduce((sum, row) => sum + (row.result === "win" ? row.odds : 0), 0);
  const canonicalRoi = canonical.length ? (returned - canonical.length) / canonical.length : null;
  const canonicalWins = canonical.filter((row) => row.result === "win").length;

  const mature = factorPerformance.filter((f) => f.n >= 3);
  const harmfulFactors = [...mature].sort((a, b) => a.roi - b.roi || b.n - a.n).slice(0, 12);
  const helpfulFactors = [...mature].sort((a, b) => b.roi - a.roi || b.n - a.n).slice(0, 12);
  const latestSettled = [...canonical]
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
