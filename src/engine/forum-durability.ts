import type { LeagueId } from "./types";

/**
 * A forum leaf may be advertised to search engines only when its league has
 * durable historical or persisted prediction coverage. Live-only leagues stay usable in the UI, but
 * are not promised as permanent indexable URLs.
 */
export const DURABLE_FORUM_LEAGUES = new Set<LeagueId>([
  "PL",
  "LL",
  "BL",
  "SA",
  "L1",
  "CL",
  "EL",
  "NL",
]);

export function durableForumLeague(league?: string | null): boolean {
  return Boolean(league && DURABLE_FORUM_LEAGUES.has(league as LeagueId));
}
