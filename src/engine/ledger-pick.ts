import { isFrenchClub } from "./french-clubs.ts";
import { publishedBeforeKickoff } from "./verify-core.ts";
import { oddsPlayable } from "../lib/markets.ts";

export type LedgerPickRow = {
  id: string;
  matchId: string;
  kickoff: string;
  home: string;
  away: string;
  market: string;
  odds: number;
  book: string;
  kind: "mise" | "prono";
  decision: string;
  league?: string;
  recordedAt: string;
  goalsHome?: number;
  goalsAway?: number;
  predictionHash?: string;
};

const TEAM_STOP = new Set([
  "fc",
  "fk",
  "cf",
  "afc",
  "sc",
  "ac",
  "rc",
  "ssc",
  "calcio",
  "rb",
  "1907",
  "club",
  "sk",
  "sv",
  "as",
  "the",
  "de",
  "ud",
  "cd",
]);

export function teamKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((p) => p && !TEAM_STOP.has(p))
    .join("");
}

export function fixtureKey(home: string, away: string, kickoff: string): string {
  return `${teamKey(home)}|${teamKey(away)}|${kickoff.slice(0, 10)}`;
}

function ticketScore(row: LedgerPickRow): number {
  let s = 0;
  if (row.odds >= 1.12 && row.odds <= 4.2) s += 8;
  if (row.book && row.book !== "non listé" && row.book !== "Opening · dérivé") s += 4;
  if (row.matchId.startsWith("espn-")) s += 2;
  if (row.predictionHash) s += 1;
  if (row.kind === "prono") s += 1;
  return s;
}

export function preferTicket<T extends LedgerPickRow>(a: T, b: T): T {
  const aBefore = publishedBeforeKickoff(a);
  const bBefore = publishedBeforeKickoff(b);
  if (aBefore !== bBefore) return aBefore ? a : b;
  // Choose by publication time before inspecting any quality tie-breakers.
  // Results and closing quotes must never displace a pre-match record.
  const aTime = Date.parse(a.recordedAt);
  const bTime = Date.parse(b.recordedAt);
  if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) return bTime > aTime ? b : a;
  const sa = ticketScore(a);
  const sb = ticketScore(b);
  if (sb !== sa) return sb > sa ? b : a;
  return b.recordedAt >= a.recordedAt ? b : a;
}

export function uniqueByFixture<T extends LedgerPickRow>(rows: T[]): T[] {
  const best = new Map<string, T>();
  for (const r of rows) {
    const key = fixtureKey(r.home, r.away, r.kickoff);
    const prev = best.get(key);
    best.set(key, prev ? preferTicket(prev, r) : r);
  }
  return [...best.values()];
}

/**
 * Canonical ROI5 accounting invariant.
 * Only 1X2 home/away BET selections inside the historical 1.80-3.00 window
 * belong to the canonical live portfolio. Secondary markets stay analytical only.
 */
export function isCanonicalRoi5Selection(
  row: Pick<LedgerPickRow, "market" | "odds" | "decision">,
): boolean {
  return (
    row.decision === "BET" &&
    (row.market === "1X2_H" || row.market === "1X2_A") &&
    oddsPlayable(row.odds)
  );
}

/** Public canonical pick: one match, listed price, same family/window as the ROI5 replay. */
export function isMethodPick(row: LedgerPickRow): boolean {
  if (row.kind === "mise") return false;
  if (!isCanonicalRoi5Selection(row)) return false;
  if (row.book === "clôture" || row.book === "non listé") return false;
  if (
    (row.league === "CL" || row.league === "EL") &&
    (isFrenchClub({ name: row.home }) || isFrenchClub({ name: row.away }))
  ) {
    return false;
  }
  return true;
}

export function compactTickets<T extends LedgerPickRow>(rows: T[]): T[] {
  const pronos = uniqueByFixture(rows.filter((r) => r.kind !== "mise"));
  const mises = new Map<string, T>();
  for (const r of rows.filter((r) => r.kind === "mise")) {
    const key = `${fixtureKey(r.home, r.away, r.kickoff)}|${r.market}`;
    const prev = mises.get(key);
    mises.set(key, prev ? preferTicket(prev, r) : r);
  }
  return [...pronos, ...mises.values()];
}
