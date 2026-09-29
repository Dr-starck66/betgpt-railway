import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export type ScoreSnap = {
  id: string;
  scoreHome?: number | null;
  scoreAway?: number | null;
  status?: string;
};

export type ScoreCorrection = {
  matchId: string;
  oldValue: string;
  newValue: string;
  correctedAt: string;
  reason: string;
};

const FILE = join(process.cwd(), "data", "score-corrections.json");

function pack(m: ScoreSnap): string {
  return `${m.status ?? ""}|${m.scoreHome ?? ""}-${m.scoreAway ?? ""}`;
}

/** Score or status transitions only. A clock tick is not a correction. */
export function diffScores(prev: ScoreSnap[], next: ScoreSnap[], at: string): ScoreCorrection[] {
  const map = new Map(prev.filter((m) => m.id).map((m) => [m.id, m]));
  const out: ScoreCorrection[] = [];
  for (const row of next) {
    if (!row.id) continue;
    const old = map.get(row.id);
    if (!old) continue;
    const oldValue = pack(old);
    const newValue = pack(row);
    if (oldValue === newValue) continue;
    out.push({
      matchId: row.id,
      oldValue,
      newValue,
      correctedAt: at,
      reason: "transition observée entre deux collectes du bureau",
    });
  }
  return out;
}

export function readCorrections(): ScoreCorrection[] {
  try {
    const parsed = JSON.parse(readFileSync(FILE, "utf8")) as unknown;
    return Array.isArray(parsed) ? (parsed as ScoreCorrection[]) : [];
  } catch {
    return [];
  }
}

export function appendCorrections(rows: ScoreCorrection[]): void {
  if (!rows.length) return;
  const merged = [...readCorrections(), ...rows].slice(-200);
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(merged));
}

export function recordScoreDiff(prev: ScoreSnap[], next: ScoreSnap[], at = new Date().toISOString()): ScoreCorrection[] {
  const rows = diffScores(prev, next, at);
  try {
    appendCorrections(rows);
  } catch {
    /* ledger is best-effort */
  }
  return rows;
}
