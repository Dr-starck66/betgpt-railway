/** Pure adapter for Pinnacle quotes present in an authorised The Odds API payload. */
import type { FrApiEvent } from "./fr-odds-provider.ts";
import type { PinnacleResearchQuote } from "./pinnacle-value-research.ts";
const MAX_AGE_MS = 5 * 60_000;
function priceOf(outcomes: {name?: string; price?: number}[], name: string): number | null {
  const matches = outcomes.filter(x => x.name?.trim().toLowerCase() === name.trim().toLowerCase());
  if (matches.length !== 1) return null;
  const v = matches[0]!.price;
  return typeof v === "number" && Number.isFinite(v) && v >= 1.05 && v <= 100 ? v : null;
}
/** Explicit authorisation gate; no network or API quota consumption inside parser. */
export function parsePinnacleFromOddsApi(
  raw: unknown,
  options: { authorizedProviderPayload: boolean; nowMs?: number },
): PinnacleResearchQuote[] {
  if (!options.authorizedProviderPayload || !Array.isArray(raw)) return [];
  const now = options.nowMs ?? Date.now();
  const out: PinnacleResearchQuote[] = [];
  for (const e of raw as FrApiEvent[]) {
    const homeTeam = e.home_team?.trim();
    const awayTeam = e.away_team?.trim();
    const kickoff = e.commence_time;
    if (!homeTeam || !awayTeam || !kickoff || homeTeam === awayTeam ||
        !Number.isFinite(Date.parse(kickoff)) || Date.parse(kickoff) <= now + 60_000) continue;
    const matches = (e.bookmakers ?? []).filter(b => b.key === "pinnacle");
    if (matches.length !== 1) continue;
    const markets = (matches[0]!.markets ?? []).filter(m => m.key === "h2h");
    if (markets.length !== 1) continue;
    const market = markets[0]!;
    const at = Date.parse(String(market.last_update ?? matches[0]!.last_update ?? ""));
    if (!Number.isFinite(at) || at > now || now - at > MAX_AGE_MS) continue;
    const selections = market.outcomes ?? [];
    if (selections.length !== 3) continue;
    const home = priceOf(selections, homeTeam);
    const draw = priceOf(selections, "Draw");
    const away = priceOf(selections, awayTeam);
    if (home === null || draw === null || away === null) continue;
    out.push({ home, draw, away, homeTeam, awayTeam, kickoff, observedAt: new Date(at).toISOString(), provenance: "LICENSED_FEED" });
  }
  return out;
}
