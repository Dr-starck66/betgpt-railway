import { it } from "node:test";
import assert from "node:assert/strict";
import { affiliateBookReadiness, affiliateConversionSnapshot } from "./affiliate-conversion.ts";
import { decorateAffiliateUrl } from "./aff-tag.ts";

it("ASTRA Affiliate Conversion Engine auto-activates a bookmaker when its env tag appears", () => {
  const previous = process.env.AFF_UNIBET;
  process.env.AFF_UNIBET = "unit-affiliate-tag";
  try {
    const state = affiliateBookReadiness("Unibet");
    assert.equal(state.mode, "MONETIZED");
    assert.equal(state.source, "env");
    assert.equal(state.configured, true);

    const url = decorateAffiliateUrl("Unibet", "https://www.unibet.fr/paris-football");
    assert.ok(url);
    assert.match(url!, /[?&]btag=unit-affiliate-tag(?:&|$)/);
    assert.match(url!, /[?&]utm_source=betgpt(?:&|$)/);
    assert.match(url!, /[?&]utm_medium=affiliate(?:&|$)/);

    const publicSnapshot = JSON.stringify(affiliateConversionSnapshot());
    assert.doesNotMatch(publicSnapshot, /unit-affiliate-tag/);
  } finally {
    if (previous == null) delete process.env.AFF_UNIBET;
    else process.env.AFF_UNIBET = previous;
  }
});

it("ASTRA Affiliate Conversion Engine fails honest for unsupported bookmakers", () => {
  const state = affiliateBookReadiness("Bookmaker Inconnu");
  assert.equal(state.mode, "UNSUPPORTED");
  assert.equal(state.configured, false);
  assert.equal(state.tracking, true);
});
