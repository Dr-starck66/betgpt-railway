import { createServerFn } from "@tanstack/react-start";
import { ensureArchiveHistory, loadArchiveHistory } from "@/engine/archive";
import type { LeagueId } from "@/engine/types";
import { getDesk } from "@/lib/desk.functions";
import { slugify } from "@/lib/programmatic";
import { parisDay, parisOffsetDay } from "@/lib/seo/money-map";
import { mergeResults, recentResults, rowFromHistory, rowFromMatch, type ResultRow } from "@/lib/serp/results";

const RESULTS_REFRESH_TTL_MS = 5 * 60_000;
const FOTMOB_DAYS = 10;

type FotMobMatch = {
  id?: number | string;
  home?: { id?: number | string; name?: string; score?: number | string };
  away?: { id?: number | string; name?: string; score?: number | string };
  status?: {
    finished?: boolean;
    cancelled?: boolean;
    utcTime?: string;
    scoreStr?: string;
  };
};

type FotMobLeague = {
  ccode?: string;
  name?: string;
  matches?: FotMobMatch[];
};

type EspnCompetition = {
  slug: string;
  league: LeagueId;
  name: string;
};

const ESPN_COMPETITIONS: EspnCompetition[] = [
  { slug: "eng.1", league: "PL", name: "Premier League" },
  { slug: "esp.1", league: "LL", name: "LaLiga" },
  { slug: "ger.1", league: "BL", name: "Bundesliga" },
  { slug: "ita.1", league: "SA", name: "Serie A" },
  { slug: "fra.1", league: "L1", name: "Ligue 1" },
  { slug: "uefa.champions", league: "CL", name: "UEFA Champions League" },
  { slug: "uefa.europa", league: "EL", name: "UEFA Europa League" },
];

const resultsMem = globalThis as typeof globalThis & {
  __betgptResultsArchiveAt?: number;
  __betgptResultsArchive?: Awaited<ReturnType<typeof ensureArchiveHistory>>;
  __betgptResultsRefresh?: Promise<Awaited<ReturnType<typeof ensureArchiveHistory>>> | null;
  __betgptFotmobAt?: number;
  __betgptFotmobRows?: ResultRow[];
  __betgptFotmobRefresh?: Promise<ResultRow[]> | null;
};

function startResultArchiveRefresh() {
  if (!resultsMem.__betgptResultsRefresh) {
    resultsMem.__betgptResultsRefresh = ensureArchiveHistory({ force: true })
      .then((rows) => {
        resultsMem.__betgptResultsArchive = rows;
        resultsMem.__betgptResultsArchiveAt = Date.now();
        return rows;
      })
      .catch(() => {
        const fallback = loadArchiveHistory();
        resultsMem.__betgptResultsArchive = fallback;
        // Negative-cache provider failures too: do not hammer ESPN on every page view.
        resultsMem.__betgptResultsArchiveAt = Date.now();
        return fallback;
      })
      .finally(() => {
        resultsMem.__betgptResultsRefresh = null;
      });
  }
  return resultsMem.__betgptResultsRefresh;
}

async function freshResultArchive() {
  const now = Date.now();
  if (
    resultsMem.__betgptResultsArchive &&
    now - (resultsMem.__betgptResultsArchiveAt ?? 0) < RESULTS_REFRESH_TTL_MS
  ) {
    return resultsMem.__betgptResultsArchive;
  }

  // Results pages must never wait for a full multi-league history refresh when a
  // usable on-disk archive already exists. Serve it immediately and refresh in
  // the background; the next request receives the refreshed snapshot.
  const disk = resultsMem.__betgptResultsArchive ?? loadArchiveHistory();
  if (disk.length) {
    resultsMem.__betgptResultsArchive = disk;
    void startResultArchiveRefresh();
    return disk;
  }

  // First boot without an archive: give the provider a short budget, then fail
  // closed to an empty archive instead of turning a page request into a timeout.
  const refresh = startResultArchiveRefresh();
  return Promise.race([
    refresh,
    new Promise<Awaited<ReturnType<typeof ensureArchiveHistory>>>((resolve) => {
      setTimeout(() => resolve(loadArchiveHistory()), 2500);
    }),
  ]);
}

function fotMobLeagueId(nameRaw: string, countryRaw: string): LeagueId | null {
  const name = nameRaw.trim();
  const country = countryRaw.toUpperCase();
  if (country === "ENG" && /^Premier League$/i.test(name)) return "PL";
  if (country === "ESP" && /^(LaLiga|La Liga)$/i.test(name)) return "LL";
  if (country === "GER" && /^Bundesliga$/i.test(name)) return "BL";
  if (country === "ITA" && /^Serie A$/i.test(name)) return "SA";
  if (country === "FRA" && /^Ligue 1$/i.test(name)) return "L1";
  if (country === "NED" && /^Eredivisie$/i.test(name)) return "ER";
  if (country === "POR" && /^(Liga Portugal|Primeira Liga)$/i.test(name)) return "PT";
  if (country === "SCO" && /^(Premiership|Scottish Premiership)$/i.test(name)) return "SC";
  if (country === "TUR" && /^(Super Lig|Süper Lig)$/i.test(name)) return "TR";
  if (country === "INT" && /^UEFA Nations League\b/i.test(name)) return "NL";
  if (country === "INT" && /Champions League/i.test(name) && !/women|youth|u19|u21/i.test(name)) return "CL";
  if (country === "INT" && /Europa League/i.test(name) && !/women|youth|u19|u21/i.test(name)) return "EL";
  return null;
}

function scoreNumber(value: number | string | undefined): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 30 ? n : null;
}

function fotMobLogo(teamId: number | string | undefined): string | undefined {
  if (teamId == null || !/^\d+$/.test(String(teamId))) return undefined;
  return `https://images.fotmob.com/image_resources/logo/teamlogo/${teamId}_small.png`;
}

function fotMobRows(payload: unknown): ResultRow[] {
  const leagues = (payload as { leagues?: FotMobLeague[] })?.leagues ?? [];
  const rows: ResultRow[] = [];
  for (const competition of leagues) {
    const league = fotMobLeagueId(String(competition.name ?? ""), String(competition.ccode ?? ""));
    if (!league) continue;
    for (const match of competition.matches ?? []) {
      if (!match.status?.finished || match.status.cancelled) continue;
      const home = String(match.home?.name ?? "").trim();
      const away = String(match.away?.name ?? "").trim();
      const scoreHome = scoreNumber(match.home?.score);
      const scoreAway = scoreNumber(match.away?.score);
      const kickoff = String(match.status.utcTime ?? "");
      const day = parisDay(kickoff);
      if (!home || !away || scoreHome == null || scoreAway == null || !day) continue;
      const homeSlug = slugify(home);
      const awaySlug = slugify(away);
      const matchId = String(match.id ?? `${homeSlug}-${awaySlug}-${day}`);
      rows.push({
        id: `fotmob-${matchId}`,
        slug: homeSlug && awaySlug ? `${homeSlug}-${awaySlug}-${day}` : `fotmob-${matchId}`,
        league,
        competition: String(competition.name ?? league),
        home,
        away,
        homeShort: home.slice(0, 3).toUpperCase(),
        awayShort: away.slice(0, 3).toUpperCase(),
        homeLogo: fotMobLogo(match.home?.id),
        awayLogo: fotMobLogo(match.away?.id),
        scoreHome,
        scoreAway,
        kickoff,
        day,
      });
    }
  }
  return rows;
}

async function fetchFotMobDay(day: string): Promise<ResultRow[]> {
  const url = `https://www.fotmob.com/api/data/matches?date=${day.replaceAll("-", "")}&ccode3=FRA&timezone=Europe%2FParis`;
  const response = await fetch(url, {
    signal: AbortSignal.timeout(7000),
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; BetGPT/1.0; +https://betgpt.live)",
      Referer: "https://www.fotmob.com/",
    },
  });
  if (!response.ok) throw new Error(`FotMob HTTP ${response.status}`);
  return fotMobRows(await response.json());
}

function espnRows(payload: unknown, competition: EspnCompetition): ResultRow[] {
  const events = (payload as { events?: Array<Record<string, unknown>> })?.events ?? [];
  const rows: ResultRow[] = [];
  for (const event of events) {
    const status = event.status as { type?: { completed?: boolean } } | undefined;
    if (!status?.type?.completed) continue;
    const eventCompetitions = event.competitions as Array<{ competitors?: Array<Record<string, unknown>> }> | undefined;
    const competitors = eventCompetitions?.[0]?.competitors ?? [];
    const home = competitors.find((x) => x.homeAway === "home");
    const away = competitors.find((x) => x.homeAway === "away");
    const homeTeam = home?.team as { id?: string; displayName?: string; shortDisplayName?: string; logo?: string } | undefined;
    const awayTeam = away?.team as { id?: string; displayName?: string; shortDisplayName?: string; logo?: string } | undefined;
    const homeName = String(homeTeam?.displayName ?? "").trim();
    const awayName = String(awayTeam?.displayName ?? "").trim();
    const scoreHome = scoreNumber(home?.score as number | string | undefined);
    const scoreAway = scoreNumber(away?.score as number | string | undefined);
    const kickoff = String(event.date ?? "");
    const day = parisDay(kickoff);
    if (!homeName || !awayName || scoreHome == null || scoreAway == null || !day) continue;
    const eventId = String(event.id ?? `${slugify(homeName)}-${slugify(awayName)}-${day}`);
    rows.push({
      id: `espn-${eventId}`,
      slug: `${slugify(homeName)}-${slugify(awayName)}-${day}`,
      league: competition.league,
      competition: competition.name,
      home: homeName,
      away: awayName,
      homeId: homeTeam?.id,
      awayId: awayTeam?.id,
      homeShort: String(homeTeam?.shortDisplayName ?? homeName.slice(0, 3)).slice(0, 4).toUpperCase(),
      awayShort: String(awayTeam?.shortDisplayName ?? awayName.slice(0, 3)).slice(0, 4).toUpperCase(),
      homeLogo: homeTeam?.logo,
      awayLogo: awayTeam?.logo,
      scoreHome,
      scoreAway,
      kickoff,
      day,
    });
  }
  return rows;
}

async function fetchEspnCompetitionDay(day: string, competition: EspnCompetition): Promise<ResultRow[]> {
  const date = day.replaceAll("-", "");
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${competition.slug}/scoreboard?dates=${date}`;
  const response = await fetch(url, {
    signal: AbortSignal.timeout(7000),
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; BetGPT/1.0; +https://betgpt.live)",
    },
  });
  if (!response.ok) throw new Error(`ESPN ${competition.slug} HTTP ${response.status}`);
  return espnRows(await response.json(), competition);
}

async function fetchEspnDay(day: string): Promise<ResultRow[]> {
  const parts = await Promise.all(
    ESPN_COMPETITIONS.map(async (competition) => {
      try {
        return await fetchEspnCompetitionDay(day, competition);
      } catch {
        return [] as ResultRow[];
      }
    }),
  );
  return parts.flat();
}

async function freshFotMobResults(now = Date.now()): Promise<ResultRow[]> {
  if (
    resultsMem.__betgptFotmobRows &&
    now - (resultsMem.__betgptFotmobAt ?? 0) < RESULTS_REFRESH_TTL_MS
  ) {
    return resultsMem.__betgptFotmobRows;
  }
  if (!resultsMem.__betgptFotmobRefresh) {
    const days = Array.from({ length: FOTMOB_DAYS }, (_, i) => parisOffsetDay(-i, now));
    resultsMem.__betgptFotmobRefresh = Promise.all(
      days.map(async (day) => {
        try {
          return await fetchFotMobDay(day);
        } catch {
          try {
            return await fetchEspnDay(day);
          } catch {
            return [] as ResultRow[];
          }
        }
      }),
    )
      .then((parts) => {
        const rows = parts.flat().sort((a, b) => b.kickoff.localeCompare(a.kickoff));
        // Cache empty/error-equivalent responses too. Otherwise a blocked
        // provider causes ten outbound requests on every page view.
        resultsMem.__betgptFotmobRows = rows;
        resultsMem.__betgptFotmobAt = Date.now();
        return rows;
      })
      .finally(() => {
        resultsMem.__betgptFotmobRefresh = null;
      });
  }
  return resultsMem.__betgptFotmobRefresh;
}

export const getResultsBoard = createServerFn({ method: "GET" }).handler(async (): Promise<{ asOf: string; rows: ResultRow[] }> => {
  const [desk, archive, fotmob] = await Promise.all([getDesk(), freshResultArchive(), freshFotMobResults()]);
  const fromDesk = (desk.matches ?? []).map(rowFromMatch).filter((r): r is ResultRow => !!r);
  const cutoff = Date.now() - 21 * 864e5;
  const fromArchive = archive
    .filter((h) => Date.parse(h.kickoff) >= cutoff)
    .map(rowFromHistory)
    .filter((r): r is ResultRow => !!r);
  const mergedExternal = mergeResults(fotmob, fromArchive);
  const rows = recentResults(mergeResults(fromDesk, mergedExternal));
  return { asOf: fotmob.length ? new Date().toISOString() : desk.liveAsOf, rows };
});
