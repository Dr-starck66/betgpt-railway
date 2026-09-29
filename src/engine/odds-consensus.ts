import { mean, removeVig } from "./math.ts";
import type { BookOdds } from "./types.ts";

export type FairTriple = { home: number; draw: number; away: number };

export type OddsConflict = {
  bookA: string;
  bookB: string;
  side: "home" | "draw" | "away";
  delta: number;
};

export type OddsConsensus = {
  status: "VERIFIED" | "UNVERIFIED" | "UNKNOWN" | "CONFLICT";
  fair: FairTriple | null;
  n: number;
  sources: { book: string; raw: FairTriple; fair: FairTriple }[];
  conflicts: OddsConflict[];
};

const CONFLICT_PP = 0.08;

export function fairFromOdds(home: number, draw: number, away: number): FairTriple {
  const [h, d, a] = removeVig([home, draw, away]);
  return { home: h, draw: d, away: a };
}

function listed(b: BookOdds): boolean {
  return b.home >= 1.05 && b.draw >= 1.05 && b.away >= 1.05;
}

export function detectOddsConflicts(books: BookOdds[]): OddsConflict[] {
  const out: OddsConflict[] = [];
  const rows = books.filter(listed).map((b) => ({
    book: b.book,
    fair: fairFromOdds(b.home, b.draw, b.away),
  }));
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i]!;
      const b = rows[j]!;
      for (const side of ["home", "draw", "away"] as const) {
        const delta = Math.abs(a.fair[side] - b.fair[side]);
        if (delta >= CONFLICT_PP) {
          out.push({ bookA: a.book, bookB: b.book, side, delta });
        }
      }
    }
  }
  return out;
}

/** Median-of-fair across books. Conflicts are recorded, never silently dropped. */
export function consensusFromBooks(books: BookOdds[], opening?: BookOdds): OddsConsensus {
  const pool = (books ?? []).filter(listed);
  const fallback = opening && listed(opening) ? [opening] : [];
  const use = pool.length ? pool : fallback;
  if (!use.length) {
    return { status: "UNKNOWN", fair: null, n: 0, sources: [], conflicts: [] };
  }
  const sources = use.map((b) => ({
    book: b.book,
    raw: { home: 1 / b.home, draw: 1 / b.draw, away: 1 / b.away },
    fair: fairFromOdds(b.home, b.draw, b.away),
  }));
  const fair: FairTriple = {
    home: mean(sources.map((s) => s.fair.home)),
    draw: mean(sources.map((s) => s.fair.draw)),
    away: mean(sources.map((s) => s.fair.away)),
  };
  const s = fair.home + fair.draw + fair.away || 1;
  fair.home /= s;
  fair.draw /= s;
  fair.away /= s;
  const conflicts = detectOddsConflicts(use);
  let status: OddsConsensus["status"] = "UNVERIFIED";
  if (conflicts.length) status = "CONFLICT";
  else if (pool.length >= 2) status = "VERIFIED";
  else if (pool.length === 1) status = "UNVERIFIED";
  else status = "UNKNOWN";
  return { status, fair, n: use.length, sources, conflicts };
}

export function valueDelta(model: FairTriple, market: FairTriple | null): FairTriple | null {
  if (!market) return null;
  return {
    home: model.home - market.home,
    draw: model.draw - market.draw,
    away: model.away - market.away,
  };
}
