import type { LeagueId } from "./types";

export type CiteRow = {
  rank: number;
  name: string;
  short: string;
  gp: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  pts: number;
  logo?: string;
};

export type CiteLeague = {
  league: LeagueId;
  slug: string;
  title: string;
  rows: CiteRow[];
};

export type CiteSnap = {
  fetchedAt: number;
  leagues: CiteLeague[];
};

export const CITE_LEAGUES: { league: LeagueId; slug: string; espn: string; title: string }[] = [
  { league: "L1", slug: "ligue-1", espn: "fra.1", title: "Ligue 1" },
  { league: "PL", slug: "premier-league", espn: "eng.1", title: "Premier League" },
  { league: "LL", slug: "la-liga", espn: "esp.1", title: "La Liga" },
  { league: "BL", slug: "bundesliga", espn: "ger.1", title: "Bundesliga" },
  { league: "SA", slug: "serie-a", espn: "ita.1", title: "Serie A" },
  { league: "CL", slug: "ligue-des-champions", espn: "uefa.champions", title: "Ligue des champions" },
  { league: "EL", slug: "ligue-europa", espn: "uefa.europa", title: "Ligue Europa" },
  { league: "NL", slug: "ligue-des-nations", espn: "uefa.nations", title: "Ligue des nations" },
];

export function citeBySlug(slug: string) {
  const key = String(slug ?? "").trim().toLowerCase();
  return CITE_LEAGUES.find((l) => l.slug === key) ?? CITE_LEAGUES.find((l) => l.league.toLowerCase() === key);
}

export function classementAnswer(title: string, rows: CiteRow[]): string {
  if (!rows.length) return `Classement ${title} : mise à jour en cours sur betgpt.live.`;
  const top = rows
    .slice(0, 5)
    .map((r) => `${r.rank}. ${r.name} ${r.pts} pts`)
    .join(", ");
  return `Classement ${title} : ${top}. Source BetGPT, betgpt.live.`;
}
