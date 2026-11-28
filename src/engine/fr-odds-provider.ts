/**
 * Optional real 1X2 quotes from The Odds API (the-odds-api.com), FR region.
 * Never derives a bookmaker price from model probabilities, results or HTML.
 * Missing key, quota exhaustion, stale quotes and ambiguous markets fail closed.
 *
 * Free-tier credit protection: at most 12 paid requests per UTC day per
 * application process. A multi-replica deployment must enforce a shared limit.
 */
import type { BookOdds, LeagueId } from "./types";
import { normName, sameFixture, EMPTY_TOTALS } from "./eu-odds";

const SPORTS: Partial<Record<LeagueId, string>> = {
  CL: "soccer_uefa_champs_league",
  EL: "soccer_uefa_europa_league",
  L1: "soccer_france_ligue_one",
  PL: "soccer_epl",
  LL: "soccer_spain_la_liga",
  BL: "soccer_germany_bundesliga",
  SA: "soccer_italy_serie_a",
};
const FR_BOOKS: Record<string, string> = {
  betclic_fr: "Betclic",
  netbet_fr: "NetBet",
  pmu_fr: "PMU",
  unibet_fr: "Unibet",
  winamax_fr: "Winamax",
};
const BOOK_DOMAINS: Record<string, string> = {
  Betclic: "betclic.fr",
  NetBet: "netbet.fr",
  PMU: "pmu.fr",
  Unibet: "unibet.fr",
  Winamax: "winamax.fr",
};
export const MAX_FR_QUOTE_AGE_MS = 5 * 60_000;
const MAX_DAILY_REQUESTS = 12;
const REFRESH_DELAY_MS = 10 * 60_000;

type ApiOutcome = { name?: string; price?: number; link?: string };
type ApiMarket = { key?: string; last_update?: string; link?: string; outcomes?: ApiOutcome[] };
type ApiBook = { key?: string; last_update?: string; link?: string; markets?: ApiMarket[] };
export type FrApiEvent = {
  home_team?: string;
  away_team?: string;
  commence_time?: string;
  bookmakers?: ApiBook[];
};
export type FrenchOddsFixture = {
  home: string;
  away: string;
  kickoff: string;
  books: BookOdds[];
};

function validBookLink(raw: unknown, book: string): string | undefined {
  if (typeof raw !== "string") return undefined;
  try {
    const url = new URL(raw);
    const domain = BOOK_DOMAINS[book];
    if (!domain || url.protocol !== "https:" || (url.hostname !== domain && !url.hostname.endsWith("." + domain))) return undefined;
    // Never send visitors to a category/homepage presented as a match deep link.
    if (url.pathname.split("/").filter(Boolean).length < 2) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}
function listedPrice(outcomes: ApiOutcome[], selection: string): number | null {
  const candidates = outcomes.filter((o) =>
    normName(o.name ?? "") === normName(selection),
  );
  if (candidates.length !== 1) return null;
  const price = candidates[0]?.price;
  return typeof price === "number" && Number.isFinite(price) && price >= 1.05 && price <= 100 ? price : null;
}
function validObservedAt(raw: unknown, nowMs: number): string | null {
  if (typeof raw !== "string") return null;
  const t = Date.parse(raw);
  if (!Number.isFinite(t) || t > nowMs + 60_000 || nowMs - t > MAX_FR_QUOTE_AGE_MS) return null;
  return new Date(t).toISOString();
}

/** Pure, testable quote parsing: ONLY current pre-match 1X2 from approved FR keys. */
export function parseFrenchOddsEvents(raw: unknown, nowMs = Date.now()): FrenchOddsFixture[] {
  if (!Array.isArray(raw)) return [];
  const fixtures: FrenchOddsFixture[] = [];
  for (const event of raw as FrApiEvent[]) {
    const home = event.home_team?.trim();
    const away = event.away_team?.trim();
    const kickoff = event.commence_time;
    const start = Date.parse(String(kickoff ?? ""));
    if (!home || !away || !kickoff || !Number.isFinite(start) || start <= nowMs + 60_000) continue;
    const books: BookOdds[] = [];
    for (const provider of event.bookmakers ?? []) {
      const book = FR_BOOKS[String(provider.key ?? "")];
      if (!book) continue;
      const markets = (provider.markets ?? []).filter((m) => m.key === "h2h");
      if (markets.length !== 1) continue;
      const market = markets[0]!;
      const observedAt = validObservedAt(market.last_update ?? provider.last_update, nowMs);
      if (!observedAt) continue;
      const outcomes = market.outcomes ?? [];
      if (outcomes.length !== 3) continue;
      const homeOdd = listedPrice(outcomes, home);
      const drawOdd = listedPrice(outcomes, "Draw");
      const awayOdd = listedPrice(outcomes, away);
      if (!homeOdd || !drawOdd || !awayOdd) continue;
      const url = validBookLink(market.link ?? provider.link, book);
      const homeUrl = validBookLink(outcomes.find((o) => normName(o.name ?? "") === normName(home))?.link, book) ?? url;
      const drawUrl = validBookLink(outcomes.find((o) => o.name === "Draw")?.link, book) ?? url;
      const awayUrl = validBookLink(outcomes.find((o) => normName(o.name ?? "") === normName(away))?.link, book) ?? url;
      books.push({
        book, home: homeOdd, draw: drawOdd, away: awayOdd,
        ...EMPTY_TOTALS, observedAt, url, homeUrl, drawUrl, awayUrl,
      });
    }
    if (books.length) fixtures.push({ home, away, kickoff, books });
  }
  return fixtures;
}

/** Preserves home/away orientation and kickoff; reversed or same-name matches are rejected. */
export function findFrenchFixture(
  fixtures: FrenchOddsFixture[],
  home: string, away: string, kickoff: string,
): FrenchOddsFixture | null {
  const target = Date.parse(kickoff);
  if (!Number.isFinite(target)) return null;
  const hits = fixtures.filter((f) =>
    Math.abs(Date.parse(f.kickoff) - target) <= 15 * 60_000 &&
    normName(f.home) !== normName(f.away) &&
    sameFixture(f.home, f.away, home, away) &&
    // sameFixture is intentionally unordered for some legacy callers; reject orientation reversal.
    (normName(f.home) === normName(home) || normName(f.home).includes(normName(home)) || normName(home).includes(normName(f.home))) &&
    (normName(f.away) === normName(away) || normName(f.away).includes(normName(away)) || normName(away).includes(normName(f.away))),
  );
  return hits.length === 1 ? hits[0]! : null;
}

let quotaDay = "";
let quotaUsed = 0;
const cached = new Map<string, { at: number; fixtures: FrenchOddsFixture[] }>();
let remainingCredits: number | null = null;

/** Server-only FR provider. Does nothing unless THE_ODDS_API_KEY is configured. */
export async function fetchFrenchBookmakerOdds(leagues: LeagueId[]): Promise<FrenchOddsFixture[]> {
  if (typeof window !== "undefined") return [];
  const key = process.env.THE_ODDS_API_KEY;
  if (!key) return [];
  const day = new Date().toISOString().slice(0, 10);
  if (quotaDay !== day) { quotaDay = day; quotaUsed = 0; }
  const leaguesToQuery = [...new Set(leagues)].filter((l) => Boolean(SPORTS[l]));
  const nowMs = Date.now();
  const all: FrenchOddsFixture[] = [];
  for (const league of leaguesToQuery) {
    const sport = SPORTS[league]!;
    const previous = cached.get(sport);
    if (previous && nowMs - previous.at < REFRESH_DELAY_MS) {
      all.push(...previous.fixtures);
      continue;
    }
    if (quotaUsed >= MAX_DAILY_REQUESTS || remainingCredits === 0) continue;
    quotaUsed++; // fail closed even on timeout: no retry storm
    try {
      const u = new URL(`https://api.the-odds-api.com/v4/sports/${sport}/odds/`);
      u.searchParams.set("apiKey", key);
      u.searchParams.set("regions", "fr");
      u.searchParams.set("markets", "h2h");
      u.searchParams.set("oddsFormat", "decimal");
      const response = await fetch(u, { signal: AbortSignal.timeout(5500), cache: "no-store" });
      const remaining = Number(response.headers.get("x-requests-remaining"));
      if (response.headers.has("x-requests-remaining") && Number.isFinite(remaining)) remainingCredits = Math.max(0, remaining);
      if (!response.ok) continue;
      const parsed = parseFrenchOddsEvents(await response.json(), Date.now());
      cached.set(sport, { at: Date.now(), fixtures: parsed });
      all.push(...parsed);
    } catch {
      // Invalid key, unavailable provider or network failure => no invented odds.
    }
  }
  return all;
}
