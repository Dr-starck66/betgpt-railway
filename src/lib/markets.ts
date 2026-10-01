import type { MarketQuote } from "@/engine/types";

export const MIN_BET_ODDS = 1.8;
/**
 * Canonical ROI5 live window.
 * Keep public staking aligned with the historical 1X2 replay instead of
 * widening the live product after the fact.
 */
export const MAX_BET_ODDS = 3.0;

export function oddsPlayable(odds: number): boolean {
  return odds >= MIN_BET_ODDS && odds <= MAX_BET_ODDS;
}

function isCanonicalMainBet(m: MarketQuote): boolean {
  return m.group === "1X2" && (m.market === "1X2_H" || m.market === "1X2_A");
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

/**
 * Canonical staking market:
 * - 1X2 only
 * - home/away only, matching the ROI5 replay
 * - canonical 1.80-3.00 odds window
 *
 * Secondary markets (BTTS, O/U, etc.) may still exist as analysis signals,
 * but can never replace the public/main BetGPT stake.
 */
export function betMarket(markets: MarketQuote[]): MarketQuote | null {
  return (
    markets.find(
      (m) => m.decision === "BET" && isCanonicalMainBet(m) && oddsPlayable(m.bestOdds),
    ) ?? null
  );
}

/**
 * Public copy: "pronostic" = most likely 1X2.
 * "mise" = canonical 1X2 BET if any. split=true when the stake is a different
 * 1X2 side than the public favorite.
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

/** Ticket CTA: canonical 1X2 BET if there is one, otherwise the headline 1-N-2. */
export function matchPick(markets: MarketQuote[]): MarketQuote {
  return betMarket(markets) ?? headlineMarket(markets);
}
