import { BETCLIC_LEAGUE, NETBET_LEAGUE, UNIBET_LEAGUE } from "@/engine/book-pages";
import type { LeagueId } from "@/engine/types";

export function bookmakerDestination(book: string, league: LeagueId, direct?: string): string | null {
  const cleanDirect = String(direct ?? "").trim();
  if (/^https:\/\//i.test(cleanDirect)) return cleanDirect;

  const n = String(book ?? "").trim().toLowerCase();
  if (!n) return null;

  if (n.includes("unibet")) return UNIBET_LEAGUE[league] ?? "https://www.unibet.fr/paris-football";
  if (n.includes("betclic")) return BETCLIC_LEAGUE[league] ?? "https://www.betclic.fr/football-sfootball";
  if (n.includes("netbet")) return NETBET_LEAGUE[league] ?? "https://www.netbet.fr/football";
  if (n.includes("winamax")) return "https://www.winamax.fr/paris-sportifs";
  if (n.includes("pmu")) return "https://paris-sportifs.pmu.fr/";
  if (n.includes("bwin")) return "https://sports.bwin.fr/fr/sports/football-4";
  if (n.includes("zebet")) return "https://www.zebet.fr/fr/competition/football";
  if (n.includes("vbet")) return "https://www.vbet.fr/fr/sports/football";
  if (n.includes("parions")) return "https://enligne.parionssport.fdj.fr/";
  if (n.includes("bet365")) return "https://www.bet365.fr/";

  return null;
}
