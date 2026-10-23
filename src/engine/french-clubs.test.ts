import assert from "node:assert/strict";
import test from "node:test";
import { isFrenchClub, skipEuropeFrenchProno } from "./french-clubs.ts";

test("recognizes French club aliases regardless of punctuation and accents", () => {
  for (const name of ["Paris Saint-Germain", "Paris-Saint-Germain", "Olympique de Marseille", "Saint-Étienne", "AS Monaco", "Olympique Lyonnais"]) {
    assert.equal(isFrenchClub({ name }), true, name);
    assert.equal(skipEuropeFrenchProno({ league: "CL", home: { name }, away: { name: "Real Madrid" } }), true);
  }
});
test("does not mistake an incidental part of foreign team names for a French club", () => {
  assert.equal(isFrenchClub({ name: "Venezia" }), false);
  assert.equal(isFrenchClub({ name: "Real Madrid" }), false);
  assert.equal(skipEuropeFrenchProno({ league: "PL", home: { name: "Paris Saint-Germain" }, away: { name: "Chelsea" } }), false);
});
