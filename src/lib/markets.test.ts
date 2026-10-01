import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { MarketQuote } from "../engine/types.ts";
import { betMarket, headlineMarket, matchPick, oddsPlayable, pronoVsStake } from "./markets.ts";

function mq(
  partial: Partial<MarketQuote> & Pick<MarketQuote, "market" | "modelProb" | "bestOdds" | "decision">,
): MarketQuote {
  return {
    label: partial.market,
    group: partial.market.startsWith("1X2") ? "1X2" : "OU",
    selection: partial.market,
    fairOdds: 2,
    bestBook: partial.bestBook ?? "Betclic",
    implied: 1 / partial.bestOdds,
    edge: 0,
    ev: 0,
    stakePct: 0,
    listed: true,
    premium: false,
    opportunityScore: 0,
    ...partial,
  };
}

const rennesMarseille = [
  mq({ market: "1X2_H", modelProb: 0.43, bestOdds: 2.1, bestBook: "Unibet", decision: "WATCH" }),
  mq({ market: "1X2_D", modelProb: 0.21, bestOdds: 3.75, bestBook: "Unibet", decision: "NO_BET" }),
  mq({ market: "1X2_A", modelProb: 0.36, bestOdds: 2.97, bestBook: "Betclic", decision: "BET" }),
];

describe("prono vs mise", () => {
  it("keeps Rennes as the public pronostic when Marseille is the canonical 1X2 value BET", () => {
    const { prono, stake, split } = pronoVsStake(rennesMarseille);
    assert.equal(headlineMarket(rennesMarseille).market, "1X2_H");
    assert.equal(prono.market, "1X2_H");
    assert.equal(prono.modelProb, 0.43);
    assert.equal(stake?.market, "1X2_A");
    assert.equal(stake?.bestOdds, 2.97);
    assert.equal(split, true);
    assert.equal(matchPick(rennesMarseille).market, "1X2_A");
    assert.equal(betMarket(rennesMarseille)?.market, "1X2_A");
    assert.notEqual(prono.market, stake?.market);
  });

  it("does not split when the BET is the favorite", () => {
    const markets = [
      mq({ market: "1X2_H", modelProb: 0.55, bestOdds: 1.85, decision: "BET" }),
      mq({ market: "1X2_D", modelProb: 0.24, bestOdds: 3.6, decision: "NO_BET" }),
      mq({ market: "1X2_A", modelProb: 0.21, bestOdds: 2.9, decision: "NO_BET" }),
    ];
    const { prono, stake, split } = pronoVsStake(markets);
    assert.equal(prono.market, "1X2_H");
    assert.equal(stake?.market, "1X2_H");
    assert.equal(split, false);
  });

  it("never lets BTTS or over/under replace the canonical 1X2 stake", () => {
    const markets = [
      mq({ market: "BTTS_Y", group: "BTTS", modelProb: 0.61, bestOdds: 2.16, decision: "BET" }),
      mq({ market: "OU_25_O", group: "OU", modelProb: 0.58, bestOdds: 2.33, decision: "BET" }),
      mq({ market: "1X2_H", modelProb: 0.46, bestOdds: 2.05, decision: "BET" }),
      mq({ market: "1X2_A", modelProb: 0.31, bestOdds: 2.8, decision: "WATCH" }),
    ];
    assert.equal(betMarket(markets)?.market, "1X2_H");
    assert.equal(matchPick(markets).market, "1X2_H");
  });

  it("returns no main stake when only secondary markets are BET", () => {
    const markets = [
      mq({ market: "BTTS_Y", group: "BTTS", modelProb: 0.61, bestOdds: 2.16, decision: "BET" }),
      mq({ market: "OU_25_O", group: "OU", modelProb: 0.58, bestOdds: 2.33, decision: "BET" }),
      mq({ market: "1X2_H", modelProb: 0.46, bestOdds: 2.05, decision: "WATCH" }),
    ];
    assert.equal(betMarket(markets), null);
    assert.equal(matchPick(markets).market, "1X2_H");
    assert.equal(matchPick(markets).decision, "WATCH");
  });
});

it("keeps the canonical ROI5 odds window at 1.80-3.00", () => {
  const markets = [
    mq({ market: "1X2_H", modelProb: 0.62, bestOdds: 1.79, decision: "BET" }),
    mq({ market: "1X2_A", modelProb: 0.18, bestOdds: 3.01, decision: "BET" }),
  ];
  assert.equal(oddsPlayable(1.79), false);
  assert.equal(oddsPlayable(1.8), true);
  assert.equal(oddsPlayable(3.0), true);
  assert.equal(oddsPlayable(3.01), false);
  assert.equal(betMarket(markets), null);
});
