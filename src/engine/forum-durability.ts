import type { LeagueId } from "./types";

/**
 * Every league supported by BetGPT may expose a durable agent-first forum.
 * Forum leaves are persisted independently from the short live desk window,
 * so indexability no longer depends on a small historical-league allowlist.
 */
export const DURABLE_FORUM_LEAGUES = new Set<LeagueId>([
  "PL",
  "LL",
  "BL",
  "SA",
  "L1",
  "ER",
  "PT",
  "SC",
  "TR",
  "CL",
  "EL",
  "NL",
]);

export function durableForumLeague(league?: string | null): boolean {
  return Boolean(league && DURABLE_FORUM_LEAGUES.has(league as LeagueId));
}
