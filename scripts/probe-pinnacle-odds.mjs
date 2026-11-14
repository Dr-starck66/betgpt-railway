#!/usr/bin/env node
/**
 * ASTRA BetGPT: one-shot The Odds API / Pinnacle probe. Never log credentials.
 * Uses the already supported THE_ODDS_API_KEY, via x-api-key header (not URL).
 * --check-key only calls /v4/sports (zero quota credits, per provider docs).
 * --one-snapshot consumes at most one odds request if credit balance is known.
 * Does not activate a paid plan, place bets or change production.
 */
const BASE = "https://api.the-odds-api.com/v4";
const DEFAULT_SPORT = "soccer_epl";
function completePinnacleH2h(event, nowMs) {
  if (!event || typeof event.home_team !== "string" || typeof event.away_team !== "string" ||
      event.home_team === event.away_team || Date.parse(event.commence_time) <= nowMs ||
      !Number.isFinite(Date.parse(event.commence_time))) return false;
  const books = (event.bookmakers ?? []).filter(b => b?.key === "pinnacle");
  if (books.length !== 1) return false;
  const markets = (books[0].markets ?? []).filter(m => m?.key === "h2h");
  if (markets.length !== 1) return false;
  const at = Date.parse(markets[0].last_update ?? books[0].last_update ?? "");
  if (!Number.isFinite(at) || at > nowMs || nowMs - at > 5 * 60_000) return false;
  const selections = markets[0].outcomes;
  if (!Array.isArray(selections) || selections.length !== 3) return false;
  for (const name of [event.home_team, "Draw", event.away_team]) {
    const matches = selections.filter(o => o?.name === name);
    if (matches.length !== 1 || !Number.isFinite(matches[0].price) ||
        matches[0].price < 1.05 || matches[0].price > 100) return false;
  }
  return true;
}
function asQuota(headers) {
  const raw = headers.get("x-requests-remaining");
  if (raw === null || !/^\d+$/.test(raw)) return null;
  return Number(raw);
}
export async function probePinnacleKey({
  key, oneSnapshot = false, sport = DEFAULT_SPORT, http = fetch,
} = {}) {
  if (typeof key !== "string" || !/^[A-Za-z0-9_-]{24,}$/.test(key)) {
    return { status: "KEY_MISSING_OR_MALFORMED" };
  }
  if (!/^soccer_[a-z0-9_]+$/.test(sport)) return { status: "SPORT_NOT_ALLOWLISTED" };
  const headers = { "x-api-key": key, Accept: "application/json" };
  const options = { headers, signal: AbortSignal.timeout(7000), cache: "no-store" };
  try {
    const check = await http(BASE + "/sports/", options);
    if (!check.ok) return { status: "KEY_UNVERIFIED", httpStatus: check.status };
    const active = await check.json();
    if (!Array.isArray(active)) return { status: "SPORTS_SCHEMA_UNVERIFIED" };
    const remaining = asQuota(check.headers);
    const isActive = active.some(s => s?.key === sport && s?.active === true);
    if (!oneSnapshot) return { status: "KEY_VALID", sportActive: isActive, quotaRemaining: remaining };
    if (!isActive) return { status: "SPORT_INACTIVE", quotaRemaining: remaining };
    // Require TWO spare credits for a single quoted-credit request, to fail closed on low quota.
    if (remaining === null || remaining < 2) return { status: "QUOTA_NOT_SAFE", quotaRemaining: remaining };
    const url = new URL(BASE + "/sports/" + sport + "/odds/");
    url.searchParams.set("bookmakers", "pinnacle");
    url.searchParams.set("markets", "h2h");
    url.searchParams.set("oddsFormat", "decimal");
    const response = await http(url.toString(), options);
    if (!response.ok) return { status: "ODDS_UNAVAILABLE", httpStatus: response.status, quotaRemaining: asQuota(response.headers) };
    const data = await response.json();
    if (!Array.isArray(data)) return { status: "ODDS_SCHEMA_UNVERIFIED" };
    const nowMs = Date.now();
    const pinnacleEvents = data.filter(e => completePinnacleH2h(e, nowMs));
    return {
      status: pinnacleEvents.length ? "PINNACLE_FEED_PRESENT" : "PINNACLE_FEED_ABSENT",
      sport, eventsReturned: data.length, pinnacleEvents: pinnacleEvents.length,
      quotaRemaining: asQuota(response.headers), checkedAt: new Date().toISOString(),
    };
  } catch {
    return { status: "NETWORK_OR_RESPONSE_ERROR" };
  }
}
if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.some(s => !["--check-key", "--one-snapshot"].includes(s))) {
    console.error("Use --check-key (zero credits) or --one-snapshot (<=1 odds request)");
    process.exitCode = 2;
  } else {
    const result = await probePinnacleKey({
      key: process.env.THE_ODDS_API_KEY,
      oneSnapshot: args.includes("--one-snapshot"),
    });
    console.log(JSON.stringify(result));
    if (!["KEY_VALID","PINNACLE_FEED_PRESENT","PINNACLE_FEED_ABSENT"].includes(result.status)) process.exitCode = 1;
  }
}
