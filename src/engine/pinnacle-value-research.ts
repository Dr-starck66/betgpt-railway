/**
 * ASTRA / BetGPT — research-only comparison with an AUTHORISED Pinnacle 1X2 feed.
 * No API calls, credentials, wagers, or changes to the public betting engine.
 * A benchmark discrepancy is NOT proof of a profitable wager.
 */
import type { BookOdds } from "./types.ts";

export type ThreeWay = { home: number; draw: number; away: number };
export type PinnacleResearchQuote = ThreeWay & {
  homeTeam: string;
  awayTeam: string;
  kickoff: string;
  observedAt: string;
  provenance: "LICENSED_FEED" | "SYNTHETIC_TEST";
};
export type FrenchResearchFixture = {
  home: string;
  away: string;
  kickoff: string;
  books: BookOdds[];
};
export type IndependentProbabilityModel = ThreeWay & {
  source: string;
  observedAt: string;
  validatedOutOfSample: boolean;
};
export type ResearchOutcome = {
  selection: "home" | "away";
  bookmaker: string;
  price: number;
  referenceProbability: number;
  modelProbability: number | null;
  benchmarkEv: number;
  modelEv: number | null;
  referenceEdge: number;
  eligible: boolean;
};
export type PinnacleResearchResult = {
  status: "NO_DATA" | "REFERENCE_ONLY" | "NO_EDGE" | "RESEARCH_CANDIDATE" | "SIMULATION";
  reason: string;
  benchmark: ThreeWay | null;
  outcomes: ResearchOutcome[];
};

const FR_BOOKS = new Set(["Betclic", "NetBet", "PMU", "Unibet", "Winamax"]);
const MAX_AGE_MS = 5 * 60_000;
const MAX_MODEL_AGE_MS = 24 * 60 * 60_000;
const MAX_KICKOFF_DIFFERENCE_MS = 15 * 60_000;
const fail = (reason: string): PinnacleResearchResult => ({
  status: "NO_DATA", reason, benchmark: null, outcomes: [],
});

function asTime(value: string): number {
  return Date.parse(value);
}
function fresh(value: string, now: number, maxAge: number): boolean {
  const t = asTime(value);
  return Number.isFinite(t) && t <= now && now - t <= maxAge;
}
function exactTeam(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}
function validThreeWay(v: ThreeWay): boolean {
  const p = [v.home, v.draw, v.away];
  return p.every(x => typeof x === "number" && Number.isFinite(x) && x >= 1.05 && x <= 100);
}
function fair(odds: ThreeWay): ThreeWay | null {
  if (!validThreeWay(odds)) return null;
  const inverse = [1 / odds.home, 1 / odds.draw, 1 / odds.away];
  const sum = inverse.reduce((a, b) => a + b, 0);
  if (sum < 1 || sum > 1.18) return null;
  return { home: inverse[0]! / sum, draw: inverse[1]! / sum, away: inverse[2]! / sum };
}
function validModel(m: IndependentProbabilityModel | null | undefined, now: number): m is IndependentProbabilityModel {
  if (!m || !m.validatedOutOfSample || !m.source.trim() || !fresh(m.observedAt, now, MAX_MODEL_AGE_MS)) return false;
  const values = [m.home, m.draw, m.away];
  return values.every(x => typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= 1)
    && Math.abs(values.reduce((a, b) => a + b, 0) - 1) < 1e-3;
}

/** No live access is implied: caller supplies only independently authorised, timestamped snapshots. */
export function evaluatePinnacleValueResearch(input: {
  pinnacle: PinnacleResearchQuote | null;
  french: FrenchResearchFixture | null;
  model?: IndependentProbabilityModel | null;
  nowMs?: number;
  minModelEv?: number;
  minBenchmarkEv?: number;
  minOdds?: number;
  maxOdds?: number;
}): PinnacleResearchResult {
  const now = input.nowMs ?? Date.now();
  const { pinnacle: p, french: f } = input;
  if (!p || !f) return fail("MISSING_PROVIDER_SNAPSHOT");
  if (!fresh(p.observedAt, now, MAX_AGE_MS)) return fail("STALE_OR_FUTURE_PINNACLE_QUOTE");
  const kickoffP = asTime(p.kickoff);
  const kickoffF = asTime(f.kickoff);
  if (!Number.isFinite(kickoffP) || !Number.isFinite(kickoffF) || kickoffP <= now + 60_000 ||
      Math.abs(kickoffF - kickoffP) > MAX_KICKOFF_DIFFERENCE_MS ||
      !p.homeTeam.trim() || !p.awayTeam.trim() ||
      exactTeam(p.homeTeam) !== exactTeam(f.home) ||
      exactTeam(p.awayTeam) !== exactTeam(f.away) ||
      exactTeam(p.homeTeam) === exactTeam(p.awayTeam)) {
    return fail("AMBIGUOUS_OR_MISMATCHED_FIXTURE");
  }
  const benchmark = fair(p);
  if (!benchmark) return fail("INVALID_PINNACLE_1X2_MARKET");
  const model = validModel(input.model, now) ? input.model! : null;
  const minModelEv = input.minModelEv ?? 0.03;
  const minBenchmarkEv = input.minBenchmarkEv ?? 0.01;
  const minOdds = input.minOdds ?? 1.8;
  const maxOdds = input.maxOdds ?? 3.0;
  if (![minModelEv, minBenchmarkEv, minOdds, maxOdds].every(Number.isFinite) ||
      minModelEv < 0 || minBenchmarkEv < 0 || minOdds <= 1 || maxOdds < minOdds) {
    return fail("INVALID_RESEARCH_POLICY");
  }
  const rows: ResearchOutcome[] = [];
  for (const selection of ["home", "away"] as const) {
    let best: { price: number; bookmaker: string } | null = null;
    for (const book of f.books ?? []) {
      if (!FR_BOOKS.has(book.book) || !book.observedAt || !fresh(book.observedAt, now, MAX_AGE_MS)) continue;
      if (!validThreeWay(book)) continue;
      const price = book[selection];
      if (price < minOdds || price > maxOdds) continue;
      if (!best || price > best.price) best = { bookmaker: book.book, price };
    }
    if (!best) continue;
    const referenceProbability = benchmark[selection];
    const benchmarkEv = referenceProbability * best.price - 1;
    const modelEv = model ? model[selection] * best.price - 1 : null;
    rows.push({
      selection, bookmaker: best.bookmaker, price: best.price,
      referenceProbability, modelProbability: model ? model[selection] : null,
      benchmarkEv, modelEv, referenceEdge: referenceProbability - 1 / best.price,
      eligible: p.provenance === "LICENSED_FEED" && modelEv !== null &&
        modelEv >= minModelEv && benchmarkEv >= minBenchmarkEv,
    });
  }
  if (!rows.length) return { status: "NO_DATA", reason: "NO_FRESH_APPROVED_FR_BOOK_PRICE", benchmark, outcomes: [] };
  if (p.provenance === "SYNTHETIC_TEST") return { status: "SIMULATION", reason: "SYNTHETIC_REFERENCE_NOT_TRADABLE", benchmark, outcomes: rows };
  if (!model) return { status: "REFERENCE_ONLY", reason: "NO_VALIDATED_INDEPENDENT_MODEL", benchmark, outcomes: rows };
  if (rows.some(row => row.eligible)) return { status: "RESEARCH_CANDIDATE", reason: "DUAL_EDGE_REQUIRES_FORWARD_VALIDATION", benchmark, outcomes: rows };
  return { status: "NO_EDGE", reason: "THRESHOLDS_NOT_MET", benchmark, outcomes: rows };
}
