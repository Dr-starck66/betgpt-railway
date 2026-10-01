import type { CoachAgentId, Decision, LeagueId, MarketKind } from "@/engine/types";

export const AGENT_LABEL: Record<CoachAgentId, { title: string; brief: string }> = {
  POSSESSION_STRUCTURAL: {
    title: "Structure",
    brief: "Occupation, relance, demi-espaces, rest defense.",
  },
  PRESSING_TRANSITION: {
    title: "Pressing",
    brief: "Hauteur de ligne, PPDA, transitions, dos de défense.",
  },
  ADAPTATION_GAME_MANAGEMENT: {
    title: "Gestion",
    brief: "Absents, repos, profondeur de banc, plan B.",
  },
  DEFENSIVE_COUNTER: {
    title: "Bloc",
    brief: "Compactness, contre, coups de pied arrêtés.",
  },
  COMPETITIVE_DISCIPLINE: {
    title: "Duels",
    brief: "Contacts, cartons, tenue du score.",
  },
};

export const LEAGUE_LABEL: Record<LeagueId, string> = {
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

export const ALL_LEAGUES: LeagueId[] = ["PL", "LL", "BL", "SA", "L1", "ER", "PT", "SC", "TR", "CL", "EL", "NL"];

export const DECISION_LABEL: Record<Decision, string> = {
  BET: "Mise",
  WATCH: "Surveiller",
  NO_BET: "Pas de mise",
};

export const MARKET_SHORT: Partial<Record<MarketKind, string>> = {
  "1X2_H": "1",
  "1X2_D": "X",
  "1X2_A": "2",
};

export const MODEL_LABEL: Record<string, string> = {
  poisson: "Buts attendus",
  dixonColes: "Buts attendus (ajusté)",
  elo: "Hiérarchie",
  xg: "Occasions",
  glm: "Contexte",
  market: "La cote",
  ensemble: "Synthèse",
  tactical_consensus: "Lecture du match",
  POSSESSION_STRUCTURAL: "Le ballon",
  PRESSING_TRANSITION: "Le pressing",
  ADAPTATION_GAME_MANAGEMENT: "Le banc",
  DEFENSIVE_COUNTER: "La défense",
  COMPETITIVE_DISCIPLINE: "L'intensité",
};


export const LEAGUE_FLAG: Record<string, string> = {
  L1: "🇫🇷",
  PL: "🇬🇧",
  LL: "🇪🇸",
  BL: "🇩🇪",
  SA: "🇮🇹",
  ER: "🇳🇱",
  PT: "🇵🇹",
  SC: "🇬🇧",
  TR: "🇹🇷",
  CL: "🇪🇺",
  EL: "🇪🇺",
};
