import { skipEuropeFrenchProno } from "../engine/french-clubs.ts";
import { betMarket } from "./markets.ts";
import type { MarketQuote, MatchInput, PredictionRecord } from "../engine/types.ts";

export type HomepageBet = { match: MatchInput; prediction: PredictionRecord; market: MarketQuote };

/**
 * Homepage spotlights may contain only canonical, future, listed BET decisions.
 * In particular, WATCH and NO_BET are not rewritten as recommendations.
 */
export function selectHomepageBets(
  matches: MatchInput[],
  predictions: PredictionRecord[],
  now = Date.now(),
  max = 3,
): HomepageBet[] {
  const byId = new Map(matches.map((m) => [m.id, m]));
  const seen = new Set<string>();
  const eligible: HomepageBet[] = [];

  for (const prediction of predictions) {
    const match = byId.get(prediction.matchId);
    if (!match || match.status !== "scheduled") continue;
    const kickoff = Date.parse(match.kickoff);
    if (!Number.isFinite(kickoff) || kickoff <= now) continue;
    if (skipEuropeFrenchProno(match) || skipEuropeFrenchProno(prediction)) continue;
    if (seen.has(match.id)) continue;
    const market = betMarket(prediction.markets);
    if (!market || !market.listed || !Number.isFinite(market.bestOdds) ||
        !Number.isFinite(market.modelProb) || market.modelProb <= 0 || market.modelProb >= 1 ||
        !Number.isFinite(market.stakePct) || market.stakePct <= 0 ||
        !Number.isFinite(market.ev) || market.ev <= 0) continue;
    seen.add(match.id);
    eligible.push({ match, prediction, market });
  }

  return eligible
    .sort((a, b) =>
      Number(b.market.premium) - Number(a.market.premium) ||
      b.market.opportunityScore - a.market.opportunityScore ||
      Date.parse(a.match.kickoff) - Date.parse(b.match.kickoff) ||
      a.match.id.localeCompare(b.match.id),
    )
    .slice(0, Math.max(0, max));
}
