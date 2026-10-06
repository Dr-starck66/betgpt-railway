import type { LeagueId } from "@/engine/types";

export type SerpCompetition = {
  slug: string;
  league: LeagueId;
  title: string;
  scoresPath: string;
  resultsPath: string;
};

export const SERP_COMPETITIONS: SerpCompetition[] = [
  { slug: "ligue-1", league: "L1", title: "Ligue 1", scoresPath: "/scores-en-direct/ligue-1", resultsPath: "/resultats-football/ligue-1" },
  { slug: "premier-league", league: "PL", title: "Premier League", scoresPath: "/scores-en-direct/premier-league", resultsPath: "/resultats-football/premier-league" },
  { slug: "la-liga", league: "LL", title: "La Liga", scoresPath: "/scores-en-direct/la-liga", resultsPath: "/resultats-football/la-liga" },
  { slug: "bundesliga", league: "BL", title: "Bundesliga", scoresPath: "/scores-en-direct/bundesliga", resultsPath: "/resultats-football/bundesliga" },
  { slug: "serie-a", league: "SA", title: "Serie A", scoresPath: "/scores-en-direct/serie-a", resultsPath: "/resultats-football/serie-a" },
  { slug: "champions-league", league: "CL", title: "Ligue des champions", scoresPath: "/scores-en-direct/champions-league", resultsPath: "/resultats-football/champions-league" },
  { slug: "ligue-europa", league: "EL", title: "Ligue Europa", scoresPath: "/scores-en-direct/ligue-europa", resultsPath: "/resultats-football/ligue-europa" },
  { slug: "ligue-des-nations", league: "NL", title: "Ligue des nations", scoresPath: "/scores-en-direct/ligue-des-nations", resultsPath: "/resultats-football/ligue-des-nations" },
];

const BY_SLUG = new Map(SERP_COMPETITIONS.map((c) => [c.slug, c]));
const SLUG_ALIASES: Record<string, string> = {
  l1: "ligue-1", pl: "premier-league", ll: "la-liga", bl: "bundesliga", sa: "serie-a",
  cl: "champions-league", el: "ligue-europa", nl: "ligue-des-nations",
  "ligue-des-champions": "champions-league", "nations-league": "ligue-des-nations",
};
const BY_LEAGUE = new Map(SERP_COMPETITIONS.map((c) => [c.league, c]));

export function competitionBySlug(slug: string): SerpCompetition | null {
  const key = String(slug ?? "").trim().toLowerCase();
  return BY_SLUG.get(SLUG_ALIASES[key] ?? key) ?? null;
}

export function competitionByLeague(league: LeagueId): SerpCompetition | null {
  return BY_LEAGUE.get(league) ?? null;
}

export const COMPETITION_NAME: Record<LeagueId, string> = {
  L1: "Ligue 1",
  PL: "Premier League",
  LL: "La Liga",
  BL: "Bundesliga",
  SA: "Serie A",
  ER: "Eredivisie",
  PT: "Primeira Liga",
  SC: "Premiership écossaise",
  TR: "Süper Lig",
  CL: "Ligue des champions",
  EL: "Ligue Europa",
  NL: "Internationaux",
};
