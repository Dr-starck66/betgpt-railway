import type { MarketQuote } from "@/engine/types";

export const MIN_BET_ODDS = 1.8;
export const MAX_BET_ODDS = 4.2;

export function oddsPlayable(odds: number): boolean {
  return odds >= MIN_BET_ODDS && odds <= MAX_BET_ODDS;
}

/** The match pronostic: most likely 1-N-2, even if that side is too short to stake. */
export function headlineMarket(markets: MarketQuote[]): MarketQuote {
  const one = markets.filter((m) => m.group === "1X2");
  const src = one.length ? one : markets;
  return [...src].sort((a, b) => {
    if (b.modelProb !== a.modelProb) return b.modelProb - a.modelProb;
    return a.bestOdds - b.bestOdds;
  })[0] ?? markets[0]!;
}

export function betMarket(markets: MarketQuote[]): MarketQuote | null {
  return markets.find((m) => m.decision === "BET" && m.bestOdds >= MIN_BET_ODDS) ?? null;
}

/**
 * Public copy: "pronostic" = most likely 1X2.
 * "mise" = BET if any. `split` when the stake is a different market than the favorite.
 */
export function pronoVsStake(markets: MarketQuote[]): {
  prono: MarketQuote;
  stake: MarketQuote | null;
  split: boolean;
} {
  const prono = headlineMarket(markets);
  const stake = betMarket(markets);
  return { prono, stake, split: Boolean(stake && stake.market !== prono.market) };
}

/** Ticket CTA: the BET if there is one, otherwise the headline 1-N-2. */
export function matchPick(markets: MarketQuote[]): MarketQuote {
  return betMarket(markets) ?? headlineMarket(markets);
}
