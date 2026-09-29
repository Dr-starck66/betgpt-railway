import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { coverHitsScore, coverStakeOf, FILET_COVER_FRAC, marketHits } from "./settle.ts";

describe("settlement", () => {
  it("1X2 and DNB void on draw for DNB", () => {
    assert.equal(marketHits("1X2_H", 2, 1), "win");
    assert.equal(marketHits("1X2_H", 1, 2), "lose");
    assert.equal(marketHits("1X2_D", 1, 1), "win");
    assert.equal(marketHits("DNB_H", 1, 1), "void");
    assert.equal(marketHits("DNB_A", 0, 0), "void");
    assert.equal(marketHits("DNB_H", 2, 1), "win");
  });

  it("filet hits only the listed exact score", () => {
    assert.equal(coverHitsScore("2-1", 2, 1), true);
    assert.equal(coverHitsScore("2-1", 1, 1), false);
    assert.equal(coverHitsScore(undefined, 1, 1), false);
    assert.equal(coverHitsScore("1-1", 1, 1), true);
  });

  it("filet stake is 50% of main / (odds-1)", () => {
    assert.equal(FILET_COVER_FRAC, 0.5);
    assert.equal(coverStakeOf(6, 100), 10);
    assert.equal(coverStakeOf(1, 100), 0);
  });
});
