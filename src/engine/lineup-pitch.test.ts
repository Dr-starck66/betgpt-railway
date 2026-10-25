import assert from "node:assert/strict";
import test from "node:test";
import { buildVerifiedPitchLayout } from "./lineup-pitch.ts";
import type { OfficialTeamLineup } from "./official-lineups.ts";

function lineup(formation = "4-2-3-1", count = 11): OfficialTeamLineup {
  return {
    teamName: "Club test",
    formation,
    starters: Array.from({ length: count }, (_, i) => ({
      id: String(i),
      name: `Joueur ${i}`,
      number: String(i + 1),
      position: i === 0 ? "GK" : i < 5 ? "DF" : i < 9 ? "MF" : "FW",
      starter: true,
    })),
    bench: [],
  };
}
test("un XI vérifié en 4-2-3-1 produit des lignes 1+4+2+3+1", () => {
  const value = buildVerifiedPitchLayout(lineup());
  assert.deepEqual(value?.lines.map((line) => line.length), [1, 4, 2, 3, 1]);
  assert.equal(value?.lines[0][0].name, "Joueur 0");
});
test("aucun terrain prétendument officiel avec seulement dix titulaires", () => {
  assert.equal(buildVerifiedPitchLayout(lineup("4-3-3", 10)), null);
});
test("aucune formation inventée ou mathématiquement incohérente", () => {
  assert.equal(buildVerifiedPitchLayout(lineup("", 11)), null);
  assert.equal(buildVerifiedPitchLayout(lineup("4-4-3", 11)), null);
  assert.equal(buildVerifiedPitchLayout(lineup("4-3-3", 11))?.formation, "4-3-3");
});
test("gardien identifié même si sa place dans le flux n'est pas la première", () => {
  const input = lineup("4-4-2");
  const keeper = input.starters.shift()!;
  input.starters.push(keeper);
  assert.equal(buildVerifiedPitchLayout(input)?.lines[0][0].name, "Joueur 0");
});
