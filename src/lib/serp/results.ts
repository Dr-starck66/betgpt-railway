import type { HistoricalMatch, LeagueId, MatchInput } from "@/engine/types";
import { slugify } from "@/lib/programmatic";
import { parisDay, parisOffsetDay } from "@/lib/seo/money-map";
import { COMPETITION_NAME } from "@/lib/serp/leagues";
import { logoFor } from "@/lib/crests";
import { hasScore } from "@/lib/serp/status";

export type ResultRow = {
  id: string;
  slug: string;
  league: LeagueId;
  competition: string;
  home: string;
  away: string;
  homeId?: string;
  awayId?: string;
  homeShort: string;
  awayShort: string;
  homeLogo?: string;
  awayLogo?: string;
  scoreHome: number;
  scoreAway: number;
  kickoff: string;
  day: string;
  /** True only when the match dossier is backed by BetGPT local/live durable data. */
  detailAvailable: boolean;
};

export function rowFromMatch(match: MatchInput): ResultRow | null {
  if (match.status !== "finished" || !hasScore(match) || !match.home?.name || !match.away?.name) return null;
  const day = parisDay(match.kickoff);
  if (!day) return null;
  return {
    id: match.id,
    slug: match.slug || `${match.id}`,
    league: match.league,
    competition: match.competition || COMPETITION_NAME[match.league],
    home: match.home.name,
    away: match.away.name,
    homeId: match.home.id,
    awayId: match.away.id,
    homeShort: match.home.short || match.home.name.slice(0, 3).toUpperCase(),
    awayShort: match.away.short || match.away.name.slice(0, 3).toUpperCase(),
    homeLogo: match.home.logo || logoFor(match.home.name, match.home.id),
    awayLogo: match.away.logo || logoFor(match.away.name, match.away.id),
    scoreHome: match.scoreHome as number,
    scoreAway: match.scoreAway as number,
    kickoff: match.kickoff,
    day,
    detailAvailable: true,
  };
}

export function rowFromHistory(h: HistoricalMatch): ResultRow | null {
  if (!h.homeName || !h.awayName) return null;
  if (!Number.isFinite(h.goalsHome) || !Number.isFinite(h.goalsAway)) return null;
  const day = parisDay(h.kickoff);
  if (!day) return null;
  const utcDay = String(h.kickoff).slice(0, 10);
  const homeSlug = slugify(h.homeName);
  const awaySlug = slugify(h.awayName);
  return {
    id: h.id,
    slug: homeSlug && awaySlug && utcDay ? `${homeSlug}-${awaySlug}-${utcDay}` : h.id,
    league: h.league,
    competition: COMPETITION_NAME[h.league] ?? h.league,
    home: h.homeName,
    away: h.awayName,
    homeId: h.homeId,
    awayId: h.awayId,
    homeShort: h.homeName.slice(0, 3).toUpperCase(),
    awayShort: h.awayName.slice(0, 3).toUpperCase(),
    homeLogo: logoFor(h.homeName, h.homeId),
    awayLogo: logoFor(h.awayName, h.awayId),
    scoreHome: h.goalsHome,
    scoreAway: h.goalsAway,
    kickoff: h.kickoff,
    day,
    detailAvailable: true,
  };
}

export function mergeResults(desk: ResultRow[], archive: ResultRow[]): ResultRow[] {
  const byKey = new Map<string, ResultRow>();
  for (const row of archive) byKey.set(row.slug || row.id, row);
  for (const row of desk) byKey.set(row.slug || row.id, row);
  return [...byKey.values()].sort((a, b) => b.kickoff.localeCompare(a.kickoff));
}

export function recentResults(rows: ResultRow[], now = Date.now(), days = 21): ResultRow[] {
  const cutoff = parisOffsetDay(-days, now);
  return rows.filter((r) => r.day >= cutoff).slice(0, 150);
}

export function recentResultDays(
  rows: ResultRow[],
  now = Date.now(),
  days = 7,
): { day: string; rows: ResultRow[] }[] {
  const safeDays = Math.max(1, Math.min(14, Math.floor(days)));
  return Array.from({ length: safeDays }, (_, i) => {
    const day = parisOffsetDay(-i, now);
    return { day, rows: rows.filter((row) => row.day === day) };
  });
}

export function bucketResults(rows: ResultRow[], now = Date.now()): {
  today: ResultRow[];
  yesterday: ResultRow[];
  previousDay: string;
  previous: ResultRow[];
} {
  const todayKey = parisOffsetDay(0, now);
  const yKey = parisOffsetDay(-1, now);
  const today = rows.filter((r) => r.day === todayKey);
  const yesterday = rows.filter((r) => r.day === yKey);
  const olderDays = [...new Set(rows.map((r) => r.day).filter((d) => d !== todayKey && d !== yKey))].sort().reverse();
  const previousDay = olderDays[0] ?? "";
  const previous = previousDay ? rows.filter((r) => r.day === previousDay) : [];
  return { today, yesterday, previousDay, previous };
}
