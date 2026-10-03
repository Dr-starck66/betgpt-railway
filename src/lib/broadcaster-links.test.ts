import assert from "node:assert/strict";
import test from "node:test";
import { extractBroadcasters, resolveBroadcasterMention, tokenizeBroadcasterText } from "./broadcaster-links.ts";

test("linkifie plusieurs diffuseurs sans perdre le texte", () => {
  const text = "Diffusion : beIN SPORTS MAX 5 et CANAL+ FOOT.";
  const tokens = tokenizeBroadcasterText(text);
  assert.equal(tokens.map((token) => token.text).join(""), text);
  const links = tokens.filter((token) => token.kind === "link");
  assert.equal(links.length, 2);
  assert.equal(links[0]?.key, "bein-sports");
  assert.equal(links[1]?.key, "canal-plus");
});

test("les liens officiels sont non sponsorisés tant qu'aucun affilié n'est configuré", () => {
  const link = resolveBroadcasterMention("DAZN");
  assert.ok(link);
  assert.equal(link.sponsored, false);
  assert.match(link.href, /^https:\/\//);
});

test("déduplique les diffuseurs dans un article", () => {
  const found = extractBroadcasters(["Sur beIN SPORTS 1.", "Aussi sur beIN SPORTS MAX 4 et TF1."]);
  assert.deepEqual(found.map((item) => item.key), ["bein-sports", "tf1"]);
});

test("priorise un diffuseur avec programme d'affiliation vérifié", () => {
  const found = extractBroadcasters(["Diffusion : beIN SPORTS 1 et DAZN."]);
  assert.deepEqual(found.map((item) => item.key), ["dazn", "bein-sports"]);
  assert.equal(found[0]?.affiliateCapable, true);
  assert.equal(found[0]?.affiliateNetwork, "Awin");
  assert.equal(found[1]?.affiliateCapable, false);
});


test("ne confond pas un média cité comme source avec un diffuseur", () => {
  const found = extractBroadcasters([
    "L'Équipe rapporte que Dayot Upamecano a quitté le rassemblement.",
    "RMC Sport confirme la nouvelle dans son article.",
    "Eurosport publie également un papier sur le sujet.",
  ]);
  assert.deepEqual(found, []);
  for (const text of [
    "L'Équipe rapporte que Dayot Upamecano a quitté le rassemblement.",
    "RMC Sport confirme la nouvelle dans son article.",
  ]) {
    assert.equal(tokenizeBroadcasterText(text).some((token) => token.kind === "link"), false);
  }
});

test("garde L'Équipe comme diffuseur quand le contexte TV est explicite", () => {
  const found = extractBroadcasters(["Diffusion TV : le match est à suivre sur la chaîne L'Équipe Live Foot."]);
  assert.equal(found.length, 1);
  assert.equal(found[0]?.key, "lequipe");
});
