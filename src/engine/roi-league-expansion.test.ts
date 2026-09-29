import assert from "node:assert/strict";
import test from "node:test";
import { ARCHIVE_LEAGUES } from "./archive.ts";
import { LEAGUES } from "./data.ts";
import {
  ROI5_CANONICAL_CHAMPION,
  ROI_ACTIVE_EXPANSION_LEAGUES,
  ROI_SHADOW_EXPANSION_LEAGUES,
  ROI_LEAGUE_EXPANSION,
  applyRoiExpansionShadowGateToMarkets,
  type ExpansionApplicableMarket,
  canonicalPromotionPass,
} from "./roi-league-expansion.ts";
import { LEAGUE_FR, LEAGUE_SLUG } from "./stats.ts";

test("expansion leagues are shadow until canonical ROI proof", () => {
  assert.deepEqual(ROI_ACTIVE_EXPANSION_LEAGUES, []);
  assert.deepEqual(ROI_SHADOW_EXPANSION_LEAGUES, ["ER", "PT", "SC", "TR"]);
  assert.equal(ROI_LEAGUE_EXPANSION.every((x) => x.screeningHistoricalRoi > 0 && x.screeningRecentRoi > 0), true);
  assert.ok(ROI5_CANONICAL_CHAMPION.roi > 0.35);
});

test("shadow league remains wired for live analysis and historical archive", () => {
  const expected = { ER: "ned.1", PT: "por.1", SC: "sco.1", TR: "tur.1" } as const;
  for (const [league, espnSlug] of Object.entries(expected)) {
    assert.ok(LEAGUES[league as keyof typeof LEAGUES]);
    assert.ok(LEAGUE_FR[league as keyof typeof LEAGUE_FR]);
    assert.ok(LEAGUE_SLUG[league as keyof typeof LEAGUE_SLUG]);
    assert.equal(ARCHIVE_LEAGUES.some((x) => x.id === league && x.slug === espnSlug), true);
  }
});

test("shadow gate blocks bankroll but leaves analysis object intact", () => {
  const markets: ExpansionApplicableMarket[] = [{ decision: "BET", stakePct: 0.03, premium: true, cover: { score: "1-1" } }];
  assert.equal(applyRoiExpansionShadowGateToMarkets(markets, "ER"), true);
  assert.equal(markets[0].decision, "NO_BET");
  assert.equal(markets[0].stakePct, 0);
  assert.equal(markets[0].premium, false);
  assert.equal(markets[0].cover, undefined);
  assert.match(markets[0].rejectionReason ?? "", /35,68/);
});

test("canonical promotion is fail-closed", () => {
  assert.equal(canonicalPromotionPass({
    roi: 0.37, maxDrawdown: 4.8, n: 190, validationRoi: 0.33, validationMaxDrawdown: 3.3, validationN: 60,
  }), true);
  assert.equal(canonicalPromotionPass({
    roi: 0.37, maxDrawdown: 4.8, n: 190, validationRoi: 0.31, validationMaxDrawdown: 3.3, validationN: 60,
  }), false);
  assert.equal(canonicalPromotionPass({
    roi: 0.36, maxDrawdown: 6.0, n: 190, validationRoi: 0.33, validationMaxDrawdown: 3.3, validationN: 60,
  }), false);
});
