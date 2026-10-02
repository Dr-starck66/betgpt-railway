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
