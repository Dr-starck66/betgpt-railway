import { logoFor } from "@/lib/crests.ts";
import { slugify } from "@/lib/programmatic.ts";
import { clamp } from "./math.ts";
import type { HistoricalMatch, LeagueId, MatchInput, TeamProfile } from "./types.ts";

const LEAGUE_NAME: Record<LeagueId, string> = {
  PL: "Premier League",
  LL: "La Liga",
  BL: "Bundesliga",
  SA: "Serie A",
  L1: "Ligue 1",
  ER: "Eredivisie",
  PT: "Primeira Liga",
  SC: "Premiership écossaise",
  TR: "Süper Lig",
  CL: "Ligue des champions",
  EL: "Ligue Europa",
  NL: "Internationaux",
};

function stubTeam(id: string, league: LeagueId, name?: string): TeamProfile {
  const label = name ?? id;
  return {
    id,
    name: label,
    short: label.slice(0, 3).toUpperCase(),
    league,
    attack: 1,
    defense: 1,
    elo: 1700,
    xgFor: 1.3,
    xgAgainst: 1.3,
    possession: 50,
    ppda: 11,
    fieldTilt: 50,
    progressivePasses: 40,
    highTurnovers: 7,
    recoveries: 46,
    compactness: 0.65,
    setPieceXg: 0.2,
    duelWin: 50,
    cardsPerGame: 2,
    flexibility: 0.55,
    pressLine: 0.55,
    buildup: 0.55,
    depth: 0.6,
    formation: "4-3-3",
    color: "#6b7c6e",
    logo: logoFor(label, id),
  };
}

export function foldMatchId(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(as|fc|cf|ac|rb|fk)\b/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

export function matchMatchesId(
  m: { id: string; slug?: string; home: { name: string }; away: { name: string }; kickoff: string },
  id: string,
): boolean {
  const want = foldMatchId(id);
  return (
    m.id === id ||
    m.slug === id ||
    foldMatchId(m.slug ?? "") === want ||
    foldMatchId(m.id) === want ||
    foldMatchId(`${m.home.name}${m.away.name}${m.kickoff.slice(0, 10)}`) === want
  );
}

/** Finished-match dossier for public pages. Does not feed the learning loop (no result leak). */
export function matchFromHistory(h: HistoricalMatch): MatchInput {
  const home = stubTeam(h.homeId, h.league, h.homeName);
  const away = stubTeam(h.awayId, h.league, h.awayName);
  const ts = h.kickoff;
  const low = {
    value: 7,
    source: "archive ESPN",
    timestamp: ts,
    confidence: 0.4,
    freshnessHours: 72,
  };
  const totalXg = clamp((home.xgFor + away.xgFor) / 2, 1.1, 3.2);
  const o25 = clamp(0.42 + (totalXg - 2.4) * 0.18, 0.38, 0.68);
  const margin = 1.055;
  const price = (p: number) => clamp(1 / (p * margin), 1.08, 15);
  const listedClose = h.closingHome >= 1.05 && h.closingDraw >= 1.05 && h.closingAway >= 1.05;
  const listedOpen = h.oddsHome >= 1.05 && h.oddsDraw >= 1.05 && h.oddsAway >= 1.05;
  const book = {
    book: listedClose ? "Clôture" : "Pinnacle",
    home: listedClose ? h.closingHome : listedOpen ? h.oddsHome : 0,
    draw: listedClose ? h.closingDraw : listedOpen ? h.oddsDraw : 0,
    away: listedClose ? h.closingAway : listedOpen ? h.oddsAway : 0,
    over15: price(clamp(o25 + 0.24, 0.62, 0.9)),
    over25: price(o25),
    over35: price(clamp(o25 - 0.22, 0.16, 0.48)),
    under25: price(1 - o25),
    bttsYes: price(clamp(0.5 + (totalXg - 2.4) * 0.1, 0.38, 0.68)),
    bttsNo: price(clamp(0.5 - (totalXg - 2.4) * 0.1, 0.32, 0.62)),
  };
  const opening = {
    ...book,
    book: "Opening",
    home: listedOpen ? h.oddsHome : book.home,
    draw: listedOpen ? h.oddsDraw : book.draw,
    away: listedOpen ? h.oddsAway : book.away,
  };
  const slug = `${slugify(home.name)}-${slugify(away.name)}-${String(ts).slice(0, 10)}`;
  return {
    id: h.id,
    league: h.league,
    competition: LEAGUE_NAME[h.league] ?? h.league,
    kickoff: h.kickoff,
    venue: "n/a",
    home,
    away,
    restHome: low,
    restAway: { ...low },
    travelAwayKm: { value: 200, source: "distance synthétique", timestamp: ts, confidence: 0.3, freshnessHours: 72 },
    congestionHome: { value: 0.25, source: "fenêtre synthétique", timestamp: ts, confidence: 0.35, freshnessHours: 72 },
    congestionAway: { value: 0.25, source: "fenêtre synthétique", timestamp: ts, confidence: 0.35, freshnessHours: 72 },
    absencesHome: { value: [], source: "indisponible à T-72h", timestamp: ts, confidence: 0.3, freshnessHours: 72 },
    absencesAway: { value: [], source: "indisponible à T-72h", timestamp: ts, confidence: 0.3, freshnessHours: 72 },
    importance: { value: 0.55, source: "contexte ligue", timestamp: ts, confidence: 0.4, freshnessHours: 72 },
    opening,
    current: [book],
    notes: [`Terminé ${h.goalsHome}–${h.goalsAway}.`, "Feuille historique ESPN."],
    status: "finished",
    scoreHome: h.goalsHome,
    scoreAway: h.goalsAway,
    slug,
  };
}
