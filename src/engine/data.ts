import type {
  Absence,
  BookOdds,
  DataPoint,
  HistoricalMatch,
  LeagueId,
  MatchInput,
  TeamProfile,
} from "./types";
import { clamp, goalMatrix, hashString, mulberry32, samplePoisson } from "./math";

const TS = "2026-09-04T12:00:00+02:00";

function dp<T>(
  value: T,
  source: string,
  confidence: number,
  freshnessHours: number,
): DataPoint<T> {
  return { value, source, timestamp: TS, confidence, freshnessHours };
}

function T(
  p: Omit<TeamProfile, "color"> & { color?: string },
): TeamProfile {
  return { color: p.color ?? "#8fad7a", ...p };
}

export const LEAGUES: Record<LeagueId, { name: string; country: string }> = {
  PL: { name: "Premier League", country: "Angleterre" },
  LL: { name: "La Liga", country: "Espagne" },
  BL: { name: "Bundesliga", country: "Allemagne" },
  SA: { name: "Serie A", country: "Italie" },
  L1: { name: "Ligue 1", country: "France" },
  ER: { name: "Eredivisie", country: "Pays-Bas" },
  PT: { name: "Primeira Liga", country: "Portugal" },
  SC: { name: "Premiership écossaise", country: "Écosse" },
  TR: { name: "Süper Lig", country: "Turquie" },
  CL: { name: "Ligue des champions", country: "Europe" },
  EL: { name: "Ligue Europa", country: "Europe" },
  NL: { name: "Internationaux", country: "International" },
};

export const TEAMS: TeamProfile[] = [
  T({ id: "mci", name: "Manchester City", short: "MCI", league: "PL", attack: 1.92, defense: 0.74, elo: 2048, xgFor: 2.18, xgAgainst: 0.88, possession: 63, ppda: 10.4, fieldTilt: 69, progressivePasses: 58, highTurnovers: 7.1, recoveries: 48, compactness: 0.72, setPieceXg: 0.28, duelWin: 52, cardsPerGame: 1.6, flexibility: 0.71, pressLine: 0.62, buildup: 0.92, depth: 0.9, formation: "3-2-4-1" }),
  T({ id: "ars", name: "Arsenal", short: "ARS", league: "PL", attack: 1.84, defense: 0.68, elo: 2036, xgFor: 2.06, xgAgainst: 0.79, possession: 58, ppda: 8.6, fieldTilt: 64, progressivePasses: 54, highTurnovers: 9.4, recoveries: 52, compactness: 0.81, setPieceXg: 0.34, duelWin: 55, cardsPerGame: 1.8, flexibility: 0.64, pressLine: 0.84, buildup: 0.78, depth: 0.82, formation: "4-3-3" }),
  T({ id: "liv", name: "Liverpool", short: "LIV", league: "PL", attack: 1.88, defense: 0.82, elo: 2018, xgFor: 2.12, xgAgainst: 1.02, possession: 59, ppda: 9.1, fieldTilt: 63, progressivePasses: 52, highTurnovers: 8.8, recoveries: 50, compactness: 0.66, setPieceXg: 0.26, duelWin: 53, cardsPerGame: 1.7, flexibility: 0.69, pressLine: 0.79, buildup: 0.74, depth: 0.78, formation: "4-2-3-1" }),
  T({ id: "che", name: "Chelsea", short: "CHE", league: "PL", attack: 1.66, defense: 0.9, elo: 1935, xgFor: 1.78, xgAgainst: 1.12, possession: 56, ppda: 9.8, fieldTilt: 57, progressivePasses: 49, highTurnovers: 7.6, recoveries: 47, compactness: 0.61, setPieceXg: 0.22, duelWin: 51, cardsPerGame: 2.1, flexibility: 0.73, pressLine: 0.7, buildup: 0.7, depth: 0.84, formation: "4-2-3-1" }),
  T({ id: "mun", name: "Manchester United", short: "MUN", league: "PL", attack: 1.52, defense: 1.05, elo: 1868, xgFor: 1.54, xgAgainst: 1.28, possession: 51, ppda: 12.2, fieldTilt: 49, progressivePasses: 41, highTurnovers: 6.2, recoveries: 44, compactness: 0.55, setPieceXg: 0.24, duelWin: 49, cardsPerGame: 2.2, flexibility: 0.58, pressLine: 0.48, buildup: 0.52, depth: 0.7, formation: "4-2-3-1" }),
  T({ id: "tot", name: "Tottenham", short: "TOT", league: "PL", attack: 1.7, defense: 1.08, elo: 1894, xgFor: 1.82, xgAgainst: 1.34, possession: 54, ppda: 9.4, fieldTilt: 55, progressivePasses: 47, highTurnovers: 8.1, recoveries: 46, compactness: 0.48, setPieceXg: 0.2, duelWin: 50, cardsPerGame: 1.9, flexibility: 0.66, pressLine: 0.76, buildup: 0.68, depth: 0.64, formation: "4-3-3" }),
  T({ id: "new", name: "Newcastle", short: "NEW", league: "PL", attack: 1.58, defense: 0.92, elo: 1902, xgFor: 1.66, xgAgainst: 1.08, possession: 49, ppda: 11.4, fieldTilt: 52, progressivePasses: 38, highTurnovers: 7.4, recoveries: 51, compactness: 0.74, setPieceXg: 0.31, duelWin: 56, cardsPerGame: 1.9, flexibility: 0.6, pressLine: 0.58, buildup: 0.48, depth: 0.61, formation: "4-3-3" }),
  T({ id: "avl", name: "Aston Villa", short: "AVL", league: "PL", attack: 1.54, defense: 0.94, elo: 1888, xgFor: 1.58, xgAgainst: 1.1, possession: 52, ppda: 10.8, fieldTilt: 53, progressivePasses: 43, highTurnovers: 7.0, recoveries: 48, compactness: 0.7, setPieceXg: 0.23, duelWin: 53, cardsPerGame: 1.8, flexibility: 0.67, pressLine: 0.6, buildup: 0.66, depth: 0.58, formation: "4-2-3-1" }),

  T({ id: "rma", name: "Real Madrid", short: "RMA", league: "LL", attack: 1.96, defense: 0.8, elo: 2062, xgFor: 2.14, xgAgainst: 0.96, possession: 58, ppda: 11.8, fieldTilt: 61, progressivePasses: 55, highTurnovers: 6.4, recoveries: 46, compactness: 0.64, setPieceXg: 0.25, duelWin: 52, cardsPerGame: 1.7, flexibility: 0.78, pressLine: 0.55, buildup: 0.8, depth: 0.92, formation: "4-3-3" }),
  T({ id: "bar", name: "Barcelona", short: "BAR", league: "LL", attack: 1.9, defense: 0.78, elo: 2044, xgFor: 2.22, xgAgainst: 0.94, possession: 67, ppda: 8.2, fieldTilt: 72, progressivePasses: 64, highTurnovers: 9.8, recoveries: 53, compactness: 0.68, setPieceXg: 0.21, duelWin: 54, cardsPerGame: 2.0, flexibility: 0.62, pressLine: 0.86, buildup: 0.94, depth: 0.8, formation: "4-3-3" }),
  T({ id: "atm", name: "Atlético Madrid", short: "ATM", league: "LL", attack: 1.48, defense: 0.66, elo: 1978, xgFor: 1.46, xgAgainst: 0.76, possession: 47, ppda: 13.6, fieldTilt: 46, progressivePasses: 32, highTurnovers: 5.4, recoveries: 54, compactness: 0.92, setPieceXg: 0.29, duelWin: 58, cardsPerGame: 2.4, flexibility: 0.55, pressLine: 0.28, buildup: 0.36, depth: 0.72, formation: "4-4-2" }),
  T({ id: "ath", name: "Athletic Club", short: "ATH", league: "LL", attack: 1.42, defense: 0.86, elo: 1884, xgFor: 1.44, xgAgainst: 1.0, possession: 50, ppda: 11.1, fieldTilt: 51, progressivePasses: 36, highTurnovers: 7.8, recoveries: 55, compactness: 0.78, setPieceXg: 0.36, duelWin: 61, cardsPerGame: 2.3, flexibility: 0.5, pressLine: 0.57, buildup: 0.44, depth: 0.54, formation: "4-2-3-1" }),
  T({ id: "rso", name: "Real Sociedad", short: "RSO", league: "LL", attack: 1.36, defense: 0.9, elo: 1856, xgFor: 1.38, xgAgainst: 1.04, possession: 54, ppda: 10.6, fieldTilt: 54, progressivePasses: 44, highTurnovers: 7.2, recoveries: 49, compactness: 0.73, setPieceXg: 0.22, duelWin: 52, cardsPerGame: 1.9, flexibility: 0.63, pressLine: 0.61, buildup: 0.72, depth: 0.56, formation: "4-3-3" }),
  T({ id: "vil", name: "Villarreal", short: "VIL", league: "LL", attack: 1.5, defense: 0.98, elo: 1862, xgFor: 1.56, xgAgainst: 1.16, possession: 53, ppda: 11.9, fieldTilt: 52, progressivePasses: 46, highTurnovers: 6.1, recoveries: 45, compactness: 0.6, setPieceXg: 0.19, duelWin: 50, cardsPerGame: 2.0, flexibility: 0.68, pressLine: 0.5, buildup: 0.76, depth: 0.6, formation: "4-4-2" }),

  T({ id: "bay", name: "Bayern Munich", short: "BAY", league: "BL", attack: 2.08, defense: 0.84, elo: 2054, xgFor: 2.34, xgAgainst: 1.02, possession: 62, ppda: 8.9, fieldTilt: 70, progressivePasses: 61, highTurnovers: 8.6, recoveries: 49, compactness: 0.58, setPieceXg: 0.27, duelWin: 54, cardsPerGame: 1.4, flexibility: 0.7, pressLine: 0.82, buildup: 0.88, depth: 0.88, formation: "4-2-3-1" }),
  T({ id: "dor", name: "Borussia Dortmund", short: "BVB", league: "BL", attack: 1.74, defense: 1.02, elo: 1948, xgFor: 1.86, xgAgainst: 1.24, possession: 55, ppda: 10.2, fieldTilt: 58, progressivePasses: 48, highTurnovers: 7.9, recoveries: 47, compactness: 0.52, setPieceXg: 0.21, duelWin: 51, cardsPerGame: 1.6, flexibility: 0.61, pressLine: 0.68, buildup: 0.7, depth: 0.66, formation: "4-2-3-1" }),
  T({ id: "lev", name: "Bayer Leverkusen", short: "LEV", league: "BL", attack: 1.72, defense: 0.88, elo: 1966, xgFor: 1.84, xgAgainst: 1.04, possession: 57, ppda: 9.6, fieldTilt: 60, progressivePasses: 53, highTurnovers: 8.2, recoveries: 50, compactness: 0.67, setPieceXg: 0.2, duelWin: 52, cardsPerGame: 1.7, flexibility: 0.74, pressLine: 0.73, buildup: 0.86, depth: 0.7, formation: "3-4-3" }),
  T({ id: "rbl", name: "RB Leipzig", short: "RBL", league: "BL", attack: 1.64, defense: 0.9, elo: 1924, xgFor: 1.72, xgAgainst: 1.08, possession: 52, ppda: 8.4, fieldTilt: 56, progressivePasses: 42, highTurnovers: 10.1, recoveries: 53, compactness: 0.71, setPieceXg: 0.24, duelWin: 55, cardsPerGame: 1.8, flexibility: 0.65, pressLine: 0.88, buildup: 0.6, depth: 0.68, formation: "4-2-2-2" }),

  T({ id: "int", name: "Inter", short: "INT", league: "SA", attack: 1.78, defense: 0.7, elo: 2028, xgFor: 1.92, xgAgainst: 0.82, possession: 56, ppda: 11.2, fieldTilt: 62, progressivePasses: 50, highTurnovers: 6.8, recoveries: 51, compactness: 0.84, setPieceXg: 0.32, duelWin: 56, cardsPerGame: 1.9, flexibility: 0.68, pressLine: 0.54, buildup: 0.74, depth: 0.8, formation: "3-5-2" }),
  T({ id: "mil", name: "AC Milan", short: "MIL", league: "SA", attack: 1.6, defense: 0.86, elo: 1942, xgFor: 1.68, xgAgainst: 1.02, possession: 54, ppda: 10.5, fieldTilt: 55, progressivePasses: 46, highTurnovers: 7.5, recoveries: 48, compactness: 0.69, setPieceXg: 0.23, duelWin: 53, cardsPerGame: 2.0, flexibility: 0.62, pressLine: 0.66, buildup: 0.68, depth: 0.64, formation: "4-2-3-1" }),
  T({ id: "juv", name: "Juventus", short: "JUV", league: "SA", attack: 1.5, defense: 0.76, elo: 1956, xgFor: 1.52, xgAgainst: 0.88, possession: 51, ppda: 12.8, fieldTilt: 50, progressivePasses: 39, highTurnovers: 5.9, recoveries: 50, compactness: 0.86, setPieceXg: 0.27, duelWin: 55, cardsPerGame: 2.2, flexibility: 0.57, pressLine: 0.42, buildup: 0.58, depth: 0.74, formation: "3-4-2-1" }),
  T({ id: "nap", name: "Napoli", short: "NAP", league: "SA", attack: 1.68, defense: 0.88, elo: 1944, xgFor: 1.76, xgAgainst: 1.04, possession: 57, ppda: 10.1, fieldTilt: 59, progressivePasses: 51, highTurnovers: 7.3, recoveries: 47, compactness: 0.65, setPieceXg: 0.22, duelWin: 51, cardsPerGame: 1.8, flexibility: 0.66, pressLine: 0.64, buildup: 0.8, depth: 0.67, formation: "4-3-3" }),
  T({ id: "ata", name: "Atalanta", short: "ATA", league: "SA", attack: 1.76, defense: 0.96, elo: 1932, xgFor: 1.9, xgAgainst: 1.18, possession: 53, ppda: 8.7, fieldTilt: 57, progressivePasses: 44, highTurnovers: 9.6, recoveries: 54, compactness: 0.54, setPieceXg: 0.25, duelWin: 57, cardsPerGame: 2.1, flexibility: 0.72, pressLine: 0.81, buildup: 0.64, depth: 0.63, formation: "3-4-3" }),

  T({ id: "psg", name: "Paris Saint-Germain", short: "PSG", league: "L1", attack: 2.02, defense: 0.76, elo: 2040, xgFor: 2.28, xgAgainst: 0.9, possession: 64, ppda: 9.2, fieldTilt: 71, progressivePasses: 60, highTurnovers: 8.0, recoveries: 47, compactness: 0.6, setPieceXg: 0.24, duelWin: 53, cardsPerGame: 1.5, flexibility: 0.69, pressLine: 0.75, buildup: 0.9, depth: 0.94, formation: "4-3-3" }),
  T({ id: "om", name: "Marseille", short: "OM", league: "L1", attack: 1.56, defense: 0.98, elo: 1866, xgFor: 1.62, xgAgainst: 1.18, possession: 52, ppda: 10.7, fieldTilt: 54, progressivePasses: 40, highTurnovers: 7.7, recoveries: 49, compactness: 0.62, setPieceXg: 0.26, duelWin: 54, cardsPerGame: 2.3, flexibility: 0.59, pressLine: 0.63, buildup: 0.55, depth: 0.57, formation: "4-2-3-1" }),
  T({ id: "mon", name: "Monaco", short: "ASM", league: "L1", attack: 1.62, defense: 0.94, elo: 1896, xgFor: 1.7, xgAgainst: 1.12, possession: 53, ppda: 9.9, fieldTilt: 56, progressivePasses: 45, highTurnovers: 8.4, recoveries: 50, compactness: 0.63, setPieceXg: 0.21, duelWin: 52, cardsPerGame: 2.0, flexibility: 0.7, pressLine: 0.72, buildup: 0.67, depth: 0.62, formation: "4-2-3-1" }),
  T({ id: "lil", name: "Lille", short: "LIL", league: "L1", attack: 1.46, defense: 0.84, elo: 1874, xgFor: 1.5, xgAgainst: 0.98, possession: 54, ppda: 11.6, fieldTilt: 53, progressivePasses: 42, highTurnovers: 6.6, recoveries: 48, compactness: 0.77, setPieceXg: 0.2, duelWin: 53, cardsPerGame: 1.8, flexibility: 0.64, pressLine: 0.5, buildup: 0.73, depth: 0.6, formation: "4-2-3-1" }),
  T({ id: "lyo", name: "Lyon", short: "OL", league: "L1", attack: 1.5, defense: 1.0, elo: 1842, xgFor: 1.56, xgAgainst: 1.2, possession: 55, ppda: 10.3, fieldTilt: 55, progressivePasses: 47, highTurnovers: 7.1, recoveries: 46, compactness: 0.58, setPieceXg: 0.22, duelWin: 50, cardsPerGame: 2.1, flexibility: 0.63, pressLine: 0.65, buildup: 0.71, depth: 0.55, formation: "4-3-3" }),
];

export const TEAM_BY_ID: Record<string, TeamProfile> = Object.fromEntries(
  TEAMS.map((t) => [t.id, t]),
);

type FixtureSpec = {
  id: string;
  league: LeagueId;
  competition: string;
  kickoff: string;
  venue: string;
  homeId: string;
  awayId: string;
  restHome: number;
  restAway: number;
  travelAwayKm: number;
  congestionHome: number;
  congestionAway: number;
  absencesHome: Absence[];
  absencesAway: Absence[];
  importance: number;
  referee?: string;
  notes: string[];
};

const FIXTURES: FixtureSpec[] = [
  {
    id: "pl-ars-mci",
    league: "PL",
    competition: "Premier League",
    kickoff: "2026-09-05T18:30:00+01:00",
    venue: "Emirates Stadium",
    homeId: "ars",
    awayId: "mci",
    restHome: 7,
    restAway: 3,
    travelAwayKm: 300,
    congestionHome: 0.15,
    congestionAway: 0.72,
    absencesHome: [],
    absencesAway: [{ player: "Rodri", role: "star", reason: "suspension", importance: 0.92 }],
    importance: 0.94,
    referee: "Michael Oliver",
    notes: [
      "City revient d'un déplacement européen mercredi.",
      "Rodri suspendu : perte de résistance au pressing au premier rideau.",
    ],
  },
  {
    id: "pl-liv-che",
    league: "PL",
    competition: "Premier League",
    kickoff: "2026-09-05T16:00:00+01:00",
    venue: "Anfield",
    homeId: "liv",
    awayId: "che",
    restHome: 6,
    restAway: 7,
    travelAwayKm: 360,
    congestionHome: 0.4,
    congestionAway: 0.2,
    absencesHome: [{ player: "Virgil van Dijk", role: "star", reason: "injury", importance: 0.88 }],
    absencesAway: [],
    importance: 0.8,
    referee: "Anthony Taylor",
    notes: ["Van Dijk forfait : ligne défensive plus exposée dans le dos."],
  },
  {
    id: "pl-new-tot",
    league: "PL",
    competition: "Premier League",
    kickoff: "2026-09-05T13:30:00+01:00",
    venue: "St James' Park",
    homeId: "new",
    awayId: "tot",
    restHome: 8,
    restAway: 7,
    travelAwayKm: 450,
    congestionHome: 0.1,
    congestionAway: 0.22,
    absencesHome: [],
    absencesAway: [{ player: "Micky van de Ven", role: "starter", reason: "injury", importance: 0.7 }],
    importance: 0.62,
    notes: ["Tottenham sans son relanceur central le plus rapide."],
  },
  {
    id: "pl-avl-mun",
    league: "PL",
    competition: "Premier League",
    kickoff: "2026-09-06T15:00:00+01:00",
    venue: "Villa Park",
    homeId: "avl",
    awayId: "mun",
    restHome: 7,
    restAway: 7,
    travelAwayKm: 140,
    congestionHome: 0.18,
    congestionAway: 0.25,
    absencesHome: [],
    absencesAway: [{ player: "Bruno Fernandes", role: "star", reason: "injury", importance: 0.8 }],
    importance: 0.58,
    notes: ["United sans son créateur principal."],
  },
  {
    id: "ll-bar-rma",
    league: "LL",
    competition: "La Liga",
    kickoff: "2026-09-06T21:00:00+02:00",
    venue: "Spotify Camp Nou",
    homeId: "bar",
    awayId: "rma",
    restHome: 7,
    restAway: 3,
    travelAwayKm: 620,
    congestionHome: 0.2,
    congestionAway: 0.7,
    absencesHome: [{ player: "Alejandro Balde", role: "starter", reason: "injury", importance: 0.62 }],
    absencesAway: [],
    importance: 0.98,
    referee: "Jesús Gil Manzano",
    notes: [
      "Clásico. Madrid réduit à trois jours de récupération.",
      "Balde absent : largeur gauche du Barça amoindrie.",
    ],
  },
  {
    id: "ll-atm-rso",
    league: "LL",
    competition: "La Liga",
    kickoff: "2026-09-05T21:00:00+02:00",
    venue: "Riyadh Air Metropolitano",
    homeId: "atm",
    awayId: "rso",
    restHome: 8,
    restAway: 7,
    travelAwayKm: 400,
    congestionHome: 0.12,
    congestionAway: 0.16,
    absencesHome: [],
    absencesAway: [],
    importance: 0.5,
    notes: ["Bloc bas d'Atlético contre construction soziista."],
  },
  {
    id: "ll-ath-vil",
    league: "LL",
    competition: "La Liga",
    kickoff: "2026-09-06T18:30:00+02:00",
    venue: "San Mamés",
    homeId: "ath",
    awayId: "vil",
    restHome: 7,
    restAway: 7,
    travelAwayKm: 530,
    congestionHome: 0.14,
    congestionAway: 0.2,
    absencesHome: [],
    absencesAway: [{ player: "Pau Torres", role: "starter", reason: "suspension", importance: 0.58 }],
    importance: 0.48,
    notes: ["San Mamés : duels et coups de pied arrêtés surpondérés."],
  },
  {
    id: "bl-bay-dor",
    league: "BL",
    competition: "Bundesliga",
    kickoff: "2026-09-05T18:30:00+02:00",
    venue: "Allianz Arena",
    homeId: "bay",
    awayId: "dor",
    restHome: 6,
    restAway: 7,
    travelAwayKm: 460,
    congestionHome: 0.35,
    congestionAway: 0.18,
    absencesHome: [],
    absencesAway: [{ player: "Julian Ryerson", role: "starter", reason: "injury", importance: 0.5 }],
    importance: 0.9,
    notes: ["Klassiker. Bayern presse haut, Dortmund transite vite."],
  },
  {
    id: "bl-lev-rbl",
    league: "BL",
    competition: "Bundesliga",
    kickoff: "2026-09-06T15:30:00+02:00",
    venue: "BayArena",
    homeId: "lev",
    awayId: "rbl",
    restHome: 7,
    restAway: 3,
    travelAwayKm: 430,
    congestionHome: 0.22,
    congestionAway: 0.68,
    absencesHome: [],
    absencesAway: [],
    importance: 0.66,
    notes: ["Leipzig revient de Ligue des champions mercredi."],
  },
  {
    id: "sa-int-mil",
    league: "SA",
    competition: "Serie A",
    kickoff: "2026-09-06T20:45:00+02:00",
    venue: "San Siro",
    homeId: "int",
    awayId: "mil",
    restHome: 7,
    restAway: 7,
    travelAwayKm: 0,
    congestionHome: 0.2,
    congestionAway: 0.28,
    absencesHome: [],
    absencesAway: [{ player: "Mike Maignan", role: "star", reason: "injury", importance: 0.74 }],
    importance: 0.92,
    referee: "Daniele Orsato",
    notes: ["Derby della Madonnina. Maignan forfait pour Milan."],
  },
  {
    id: "sa-juv-nap",
    league: "SA",
    competition: "Serie A",
    kickoff: "2026-09-06T18:00:00+02:00",
    venue: "Allianz Stadium",
    homeId: "juv",
    awayId: "nap",
    restHome: 8,
    restAway: 6,
    travelAwayKm: 890,
    congestionHome: 0.1,
    congestionAway: 0.34,
    absencesHome: [],
    absencesAway: [],
    importance: 0.7,
    notes: ["Bloc compact de la Juve contre occupation du camp napolitain."],
  },
  {
    id: "l1-psg-om",
    league: "L1",
    competition: "Ligue 1",
    kickoff: "2026-09-06T20:45:00+02:00",
    venue: "Parc des Princes",
    homeId: "psg",
    awayId: "om",
    restHome: 7,
    restAway: 7,
    travelAwayKm: 750,
    congestionHome: 0.25,
    congestionAway: 0.2,
    absencesHome: [],
    absencesAway: [{ player: "Mason Greenwood", role: "starter", reason: "suspension", importance: 0.66 }],
    importance: 0.96,
    referee: "Clément Turpin",
    notes: ["Classique. OM sans son relais offensif le plus décisif."],
  },
  {
    id: "l1-mon-lyo",
    league: "L1",
    competition: "Ligue 1",
    kickoff: "2026-09-05T17:00:00+02:00",
    venue: "Stade Louis-II",
    homeId: "mon",
    awayId: "lyo",
    restHome: 7,
    restAway: 7,
    travelAwayKm: 430,
    congestionHome: 0.16,
    congestionAway: 0.18,
    absencesHome: [],
    absencesAway: [],
    importance: 0.46,
    notes: ["Deux blocs qui acceptent l'ouverture du jeu."],
  },
  {
    id: "ucl-lil-ata",
    league: "L1",
    competition: "Ligue des champions",
    kickoff: "2026-09-08T21:00:00+02:00",
    venue: "Stade Pierre-Mauroy",
    homeId: "lil",
    awayId: "ata",
    restHome: 8,
    restAway: 3,
    travelAwayKm: 980,
    congestionHome: 0.12,
    congestionAway: 0.74,
    absencesHome: [],
    absencesAway: [{ player: "Gianluca Scamacca", role: "starter", reason: "injury", importance: 0.55 }],
    importance: 0.78,
    notes: ["Atalanta à J+3 après un déplacement. Lille frais, bloc discipliné."],
  },
];

function cloneOdds(o: BookOdds): BookOdds {
  return { ...o };
}

function makeBooks(
  id: string,
  home: TeamProfile,
  away: TeamProfile,
  restH: number,
  restA: number,
): { opening: BookOdds; current: BookOdds[] } {
  const rng = mulberry32(hashString(`odds:${id}`));
  const homeAdv = 1.12;
  const fatigueH = restH < 4 ? 0.92 : 1;
  const fatigueA = restA < 4 ? 0.9 : 1;
  const lh = home.attack * away.defense * homeAdv * fatigueH;
  const la = away.attack * home.defense * fatigueA;
  const trueM = goalMatrix(lh * 0.92, la * 0.92, -0.11);

  const books = ["Pinnacle", "bet365", "Unibet", "Winamax", "Betclic"];
  const current: BookOdds[] = books.map((book, bi) => {
    const sharp = book === "Pinnacle" ? 0.35 : book === "bet365" ? 0.7 : 1;
    const noise = () => (rng() - 0.5) * 0.08 * sharp;
    let ph = clamp(trueM.home + noise(), 0.12, 0.78);
    let pd = clamp(trueM.draw + noise() * 0.6, 0.14, 0.34);
    let pa = clamp(trueM.away + noise(), 0.1, 0.7);
    const s = ph + pd + pa;
    ph /= s;
    pd /= s;
    pa /= s;
    const margin = 1.055 + bi * 0.012;
    const o25 = clamp(trueM.over25 + (rng() - 0.5) * 0.06 * sharp, 0.35, 0.72);
    const o15 = clamp(trueM.over15 + (rng() - 0.5) * 0.04 * sharp, 0.62, 0.9);
    const o35 = clamp(trueM.over35 + (rng() - 0.5) * 0.05 * sharp, 0.18, 0.5);
    const btts = clamp(trueM.bttsYes + (rng() - 0.5) * 0.06 * sharp, 0.35, 0.7);
    const price = (p: number) => clamp(1 / (p * margin), 1.08, 15);
    return {
      book,
      home: price(ph),
      draw: price(pd),
      away: price(pa),
      over15: price(o15),
      over25: price(o25),
      over35: price(o35),
      under25: price(1 - o25),
      bttsYes: price(btts),
      bttsNo: price(1 - btts),
    };
  });

  const opening = cloneOdds(current[0]!);
  opening.book = "Opening";
  const drift = mulberry32(hashString(`open:${id}`));
  const jitter = (x: number) => clamp(x * (1 + (drift() - 0.5) * 0.06), 1.08, 16);
  opening.home = jitter(opening.home);
  opening.draw = jitter(opening.draw);
  opening.away = jitter(opening.away);
  opening.over25 = jitter(opening.over25);
  return { opening, current };
}

export function getUpcomingMatches(): MatchInput[] {
  return FIXTURES.map((f) => {
    const home = TEAM_BY_ID[f.homeId]!;
    const away = TEAM_BY_ID[f.awayId]!;
    const books = makeBooks(f.id, home, away, f.restHome, f.restAway);
    return {
      id: f.id,
      league: f.league,
      competition: f.competition,
      kickoff: f.kickoff,
      venue: f.venue,
      referee: f.referee
        ? dp(f.referee, "comité arbitral", 0.9, 12)
        : undefined,
      home,
      away,
      restHome: dp(f.restHome, "calendrier UEFA/ligue", 0.95, 6),
      restAway: dp(f.restAway, "calendrier UEFA/ligue", 0.95, 6),
      travelAwayKm: dp(f.travelAwayKm, "distance siège", 0.8, 24),
      congestionHome: dp(f.congestionHome, "fenêtre 10 jours", 0.85, 6),
      congestionAway: dp(f.congestionAway, "fenêtre 10 jours", 0.85, 6),
      absencesHome: dp(f.absencesHome, "feuille d'effectif interne", 0.7, 18),
      absencesAway: dp(f.absencesAway, "feuille d'effectif interne", 0.7, 18),
      importance: dp(f.importance, "contexte compétition", 0.75, 24),
      opening: books.opening,
      current: books.current,
      notes: f.notes,
    };
  });
}

export function generateHistory(): HistoricalMatch[] {
  const rng = mulberry32(20260904);
  const byLeague = new Map<LeagueId, TeamProfile[]>();
  for (const t of TEAMS) {
    const list = byLeague.get(t.league) ?? [];
    list.push(t);
    byLeague.set(t.league, list);
  }
  const out: HistoricalMatch[] = [];
  let n = 0;
  for (const [league, teams] of byLeague) {
    for (let i = 0; i < teams.length; i++) {
      for (let j = 0; j < teams.length; j++) {
        if (i === j) continue;
        const home = teams[i]!;
        const away = teams[j]!;
        const lh = home.attack * away.defense * 1.12;
        const la = away.attack * home.defense;
        const gh = samplePoisson(lh, rng);
        const ga = samplePoisson(la, rng);
        const m = goalMatrix(lh, la, -0.12);
        const noise = (p: number) => clamp(p + (rng() - 0.5) * 0.07, 0.08, 0.8);
        let ph = noise(m.home);
        let pd = noise(m.draw);
        let pa = noise(m.away);
        const s = ph + pd + pa;
        ph /= s;
        pd /= s;
        pa /= s;
        const margin = 1.06;
        const kick = new Date(Date.UTC(2025, 7, 12 + (n % 250)));
        const openH = 1 / (ph * margin);
        const openD = 1 / (pd * margin);
        const openA = 1 / (pa * margin);
        const closeJ = 1 + (rng() - 0.5) * 0.04;
        out.push({
          id: `h-${league}-${n}`,
          league,
          kickoff: kick.toISOString(),
          homeId: home.id,
          awayId: away.id,
          goalsHome: gh,
          goalsAway: ga,
          oddsHome: openH,
          oddsDraw: openD,
          oddsAway: openA,
          closingHome: clamp(openH * closeJ, 1.08, 14),
          closingDraw: clamp(openD * (1 + (rng() - 0.5) * 0.03), 1.08, 14),
          closingAway: clamp(openA / closeJ, 1.08, 14),
          sourceKind: "synthetic-test",
        });
        n += 1;
      }
    }
  }
  return out;
}

export const ENGINE_VERSION = "betgpt-ensemble-1.0.0";
export const TACTICAL_VERSION = "coach-intel-1.0.0";
export const FEATURE_VERSION = "tactical-features-1.0.0";
