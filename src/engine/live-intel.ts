import type { Absence, BookOdds, DataPoint, MatchInput, PredictionRecord } from "./types.ts";
import { consensusFromBooks, valueDelta, type OddsConsensus } from "./odds-consensus.ts";
import { confidenceBreakdown, type ConfidenceBreakdown } from "./confidence.ts";
import type { ChangeReport } from "./change-detect.ts";

export const INTEL_VERSION = "live-intel-1.0.0";

export type VerificationStatus = "VERIFIED" | "UNVERIFIED" | "UNKNOWN" | "CONFLICT";

export type SourceFact<T> = {
  value: T | null;
  source: string;
  sourceURL?: string;
  retrievedAt: string;
  publishedAt?: string;
  confidence: number;
  verificationStatus: VerificationStatus;
};

export type MatchIntelligence = {
  matchId: string;
  competition: string;
  season: string;
  kickoff: string;
  homeTeam: { id: string; name: string };
  awayTeam: { id: string; name: string };
  standings: SourceFact<null>;
  recentForm: SourceFact<{ home: string | null; away: string | null }>;
  goalsFor: SourceFact<{ home: number; away: number }>;
  goalsAgainst: SourceFact<{ home: number; away: number }>;
  homePerformance: SourceFact<{ attack: number; defense: number; elo: number }>;
  awayPerformance: SourceFact<{ attack: number; defense: number; elo: number }>;
  injuries: SourceFact<Absence[]>;
  suspensions: SourceFact<Absence[]>;
  manager: SourceFact<null>;
  recentManagerChange: SourceFact<null>;
  expectedLineups: SourceFact<{ home: string; away: string }>;
  confirmedLineups: SourceFact<null>;
  odds: SourceFact<{ home: number; draw: number; away: number; books: string[] }>;
  oddsHistory: SourceFact<{
    opening: { home: number; draw: number; away: number };
    current: { home: number; draw: number; away: number };
  }>;
  sourceEvidence: SourceFact<unknown>[];
  sourceTimestamp: string;
  predictionTimestamp: string;
  dataFreshness: { minutes: number | null; label: string };
  uncertainty: string[];
};

export type LivePredictionView = {
  confidence10: number;
  components: ConfidenceBreakdown;
  freshnessMinutes: number | null;
  freshnessLabel: string;
  valueDelta: { home: number; draw: number; away: number } | null;
  consensus: { home: number; draw: number; away: number } | null;
  consensusStatus: VerificationStatus;
  oddsConflicts: { bookA: string; bookB: string; side: string; delta: number }[];
  uncertainty: string[];
  unknown: string[];
  likelyScores: { score: string; p: number }[];
  expectedGoals: { home: number; away: number };
};

function fact<T>(
  value: T | null,
  source: string,
  status: VerificationStatus,
  confidence: number,
  retrievedAt: string,
): SourceFact<T> {
  return { value, source, retrievedAt, confidence, verificationStatus: status };
}

function fromPoint<T>(point: DataPoint<T> | undefined, empty: VerificationStatus): SourceFact<T | null> {
  if (!point) return fact<T | null>(null, "unavailable", empty, 0, new Date().toISOString());
  const missing = point.value == null || (Array.isArray(point.value) && point.value.length === 0);
  return {
    value: missing ? null : point.value,
    source: point.source,
    retrievedAt: point.timestamp,
    confidence: point.confidence,
    verificationStatus: missing ? "UNKNOWN" : "UNVERIFIED",
  };
}

export function seasonOf(kickoff: string): string {
  const y = Number(kickoff.slice(0, 4));
  const m = Number(kickoff.slice(5, 7));
  if (!Number.isFinite(y)) return "UNKNOWN";
  return m >= 7 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

export function freshnessOf(retrievedAt: string, now = Date.now()): { minutes: number | null; label: string } {
  const t = Date.parse(retrievedAt);
  if (!Number.isFinite(t)) return { minutes: null, label: "Fraîcheur inconnue" };
  const minutes = Math.max(0, Math.round((now - t) / 60000));
  if (minutes < 60) return { minutes, label: `${minutes} min` };
  if (minutes < 24 * 60) return { minutes, label: `${Math.round(minutes / 60)} h` };
  return { minutes, label: `${Math.round(minutes / 1440)} j` };
}

function listedBooks(match: MatchInput): BookOdds[] {
  return (match.current ?? []).filter((b) => b.home >= 1.05 && b.draw >= 1.05 && b.away >= 1.05);
}

function splitAbsences(list: Absence[]): { injuries: Absence[]; suspensions: Absence[] } {
  return {
    injuries: list.filter((a) => a.reason === "injury"),
    suspensions: list.filter((a) => a.reason === "suspension"),
  };
}

/** Canonical intelligence object. Missing facts stay UNKNOWN — never invented. */
export function buildMatchIntelligence(
  match: MatchInput,
  prediction?: PredictionRecord,
  now = Date.now(),
): MatchIntelligence {
  const retrieved =
    match.absencesHome.timestamp ||
    match.restHome.timestamp ||
    prediction?.timestamp ||
    new Date(now).toISOString();
  const homeAbs = match.absencesHome.value ?? [];
  const awayAbs = match.absencesAway.value ?? [];
  const allAbs = [...homeAbs, ...awayAbs];
  const { injuries, suspensions } = splitAbsences(allAbs);
  const books = listedBooks(match);
  const uncertainty: string[] = [];

  if (!match.formHome || !match.formAway) uncertainty.push("forme récente incomplète");
  if (!homeAbs.length && !awayAbs.length) uncertainty.push("blessures / suspensions non listées");
  if (!books.length) uncertainty.push("cotes bookmaker absentes");
  uncertainty.push("classement non branché");
  uncertainty.push("entraîneur non observé");
  uncertainty.push("compositions confirmées non observées");
  if (match.absencesHome.confidence < 0.5 || match.absencesAway.confidence < 0.5) {
    uncertainty.push("absences à faible confiance");
  }
  if (match.oddsSource === "modèle" || !match.oddsSource) {
    uncertainty.push("cotes non listées chez un book");
  }

  const best = books[0];
  const opening = match.opening;

  return {
    matchId: match.id,
    competition: match.competition,
    season: seasonOf(match.kickoff),
    kickoff: match.kickoff,
    homeTeam: { id: match.home.id, name: match.home.name },
    awayTeam: { id: match.away.id, name: match.away.name },
    standings: fact(null, "unavailable", "UNKNOWN", 0, retrieved),
    recentForm: fact(
      { home: match.formHome ?? null, away: match.formAway ?? null },
      match.formHome ? "calendrier" : "unavailable",
      match.formHome && match.formAway ? "UNVERIFIED" : "UNKNOWN",
      match.formHome && match.formAway ? 0.7 : 0.2,
      retrieved,
    ),
    goalsFor: fact(
      { home: match.home.xgFor, away: match.away.xgFor },
      "modèle interne (xG estimé, pas des buts officiels)",
      "UNVERIFIED",
      0.45,
      retrieved,
    ),
    goalsAgainst: fact(
      { home: match.home.xgAgainst, away: match.away.xgAgainst },
      "modèle interne (xG estimé, pas des buts officiels)",
      "UNVERIFIED",
      0.45,
      retrieved,
    ),
    homePerformance: fact(
      { attack: match.home.attack, defense: match.home.defense, elo: match.home.elo },
      "modèle interne",
      "UNVERIFIED",
      0.5,
      retrieved,
    ),
    awayPerformance: fact(
      { attack: match.away.attack, defense: match.away.defense, elo: match.away.elo },
      "modèle interne",
      "UNVERIFIED",
      0.5,
      retrieved,
    ),
    injuries: fact(
      injuries.length ? injuries : null,
      match.absencesHome.source,
      injuries.length ? "UNVERIFIED" : "UNKNOWN",
      match.absencesHome.confidence,
      match.absencesHome.timestamp,
    ),
    suspensions: fact(
      suspensions.length ? suspensions : null,
      match.absencesHome.source,
      suspensions.length ? "UNVERIFIED" : "UNKNOWN",
      match.absencesHome.confidence,
      match.absencesHome.timestamp,
    ),
    manager: fact(null, "unavailable", "UNKNOWN", 0, retrieved),
    recentManagerChange: fact(null, "unavailable", "UNKNOWN", 0, retrieved),
    expectedLineups: fact(
      { home: match.home.formation || "", away: match.away.formation || "" },
      "schéma listé (pas une compo confirmée)",
      match.home.formation ? "UNVERIFIED" : "UNKNOWN",
      0.4,
      retrieved,
    ),
    confirmedLineups: fact(null, "unavailable", "UNKNOWN", 0, retrieved),
    odds: fact(
      best
        ? { home: best.home, draw: best.draw, away: best.away, books: books.map((b) => b.book) }
        : null,
      match.oddsSource ?? (best ? best.book : "unavailable"),
      books.length >= 2 ? "VERIFIED" : books.length === 1 ? "UNVERIFIED" : "UNKNOWN",
      books.length >= 2 ? 0.85 : books.length === 1 ? 0.55 : 0,
      retrieved,
    ),
    oddsHistory: fact(
      opening?.home >= 1.05
        ? {
            opening: { home: opening.home, draw: opening.draw, away: opening.away },
            current: {
              home: best?.home ?? opening.home,
              draw: best?.draw ?? opening.draw,
              away: best?.away ?? opening.away,
            },
          }
        : null,
      "opening vs last listed",
      opening?.home >= 1.05 ? "UNVERIFIED" : "UNKNOWN",
      0.5,
      retrieved,
    ),
    sourceEvidence: [
      fromPoint(match.absencesHome, "UNKNOWN"),
      fromPoint(match.absencesAway, "UNKNOWN"),
      fromPoint(match.restHome, "UNKNOWN"),
      fromPoint(match.restAway, "UNKNOWN"),
    ],
    sourceTimestamp: retrieved,
    predictionTimestamp: prediction?.timestamp ?? retrieved,
    dataFreshness: freshnessOf(retrieved, now),
    uncertainty: [...new Set(uncertainty)],
  };
}

export function likelyScores(matrix: number[][] | undefined, n = 3): { score: string; p: number }[] {
  if (!matrix?.length) return [];
  const cells: { score: string; p: number }[] = [];
  for (let i = 0; i < Math.min(6, matrix.length); i++) {
    const row = matrix[i] ?? [];
    for (let j = 0; j < Math.min(6, row.length); j++) {
      cells.push({ score: `${i}-${j}`, p: row[j] ?? 0 });
    }
  }
  cells.sort((a, b) => b.p - a.p);
  return cells.filter((c) => c.p > 0).slice(0, n);
}

export function buildLiveView(
  match: MatchInput,
  prediction: PredictionRecord,
  now = Date.now(),
): LivePredictionView {
  const intel = buildMatchIntelligence(match, prediction, now);
  const consensus = consensusFromBooks(match.current ?? [], match.opening);
  const delta = valueDelta(
    { home: prediction.calibrated.home, draw: prediction.calibrated.draw, away: prediction.calibrated.away },
    consensus.fair,
  );
  const components = confidenceBreakdown({
    match,
    prediction,
    consensus,
    freshnessMinutes: intel.dataFreshness.minutes,
  });
  return {
    confidence10: components.score10,
    components,
    freshnessMinutes: intel.dataFreshness.minutes,
    freshnessLabel: intel.dataFreshness.label,
    valueDelta: delta,
    consensus: consensus.fair,
    consensusStatus: consensus.status,
    oddsConflicts: consensus.conflicts,
    uncertainty: intel.uncertainty,
    unknown: intel.uncertainty.filter((u) => /non (branché|observé|listé)|incomplète|absentes/i.test(u)),
    likelyScores: likelyScores(prediction.ensemble.matrix),
    expectedGoals: {
      home: prediction.ensemble.lambdaHome,
      away: prediction.ensemble.lambdaAway,
    },
  };
}

export function inputSnapshot(match: MatchInput): string {
  const abs = (list: Absence[]) =>
    [...list]
      .map((a) => `${a.player}:${a.reason}:${a.role}`)
      .sort()
      .join(",");
  const books = listedBooks(match)
    .map((b) => `${b.book}:${b.home.toFixed(2)}:${b.draw.toFixed(2)}:${b.away.toFixed(2)}`)
    .sort();
  return JSON.stringify({
    absH: abs(match.absencesHome.value ?? []),
    absA: abs(match.absencesAway.value ?? []),
    formH: match.formHome ?? "",
    formA: match.formAway ?? "",
    fH: match.home.formation,
    fA: match.away.formation,
    venue: match.venue,
    status: match.status ?? "scheduled",
    voidReason: match.voidReason ?? "",
    books,
  });
}

export function attachLiveIntel(match: MatchInput, prediction: PredictionRecord): PredictionRecord {
  const view = buildLiveView(match, prediction);
  return { ...prediction, live: view };
}

export type { OddsConsensus, ChangeReport, ConfidenceBreakdown };
