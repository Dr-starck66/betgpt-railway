import { BETCLIC_LEAGUE, NETBET_LEAGUE, UNIBET_LEAGUE } from "@/engine/book-pages";
import type { LeagueId } from "@/engine/types";

const GENERIC_BOOKMAKER_URLS = new Set(
  [
    ...Object.values(UNIBET_LEAGUE),
    ...Object.values(BETCLIC_LEAGUE),
    ...Object.values(NETBET_LEAGUE),
    "https://www.unibet.fr/paris-football",
    "https://www.betclic.fr/football-sfootball",
    "https://www.netbet.fr/football",
    "https://www.winamax.fr/paris-sportifs",
    "https://paris-sportifs.pmu.fr/",
    "https://sports.bwin.fr/fr/sports/football-4",
    "https://www.zebet.fr/fr/competition/football",
    "https://www.vbet.fr/fr/sports/football",
    "https://enligne.parionssport.fdj.fr/",
    "https://www.bet365.fr/",
  ].filter((x): x is string => Boolean(x)),
);

function normalizedUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return null;
    u.hash = "";
    return u.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

const GENERIC_NORMALIZED = new Set(
  [...GENERIC_BOOKMAKER_URLS].map((u) => normalizedUrl(u)).filter((u): u is string => Boolean(u)),
);

export function isExactBookmakerMatchUrl(raw?: string): boolean {
  const clean = normalizedUrl(String(raw ?? "").trim());
  if (!clean || GENERIC_NORMALIZED.has(clean)) return false;
  const u = new URL(clean);
  if (u.pathname === "/" || u.pathname.split("/").filter(Boolean).length < 2) return false;
  return true;
}

export function bookmakerDestination(_book: string, _league: LeagueId, direct?: string): string | null {
  const clean = normalizedUrl(String(direct ?? "").trim());
  if (!clean || !isExactBookmakerMatchUrl(clean)) return null;
  return clean;
}
