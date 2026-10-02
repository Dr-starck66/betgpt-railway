import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { cleanPublicImageAlt, containsInternalImageCopy, editorialImageCaption } from "./image-copy.ts";
import type { EditorialArticle } from "./types.ts";

const INTERNAL_PUBLIC_JARGON =
  /libre de droits|unsplash|pexels|recadr(?:ée|e|é)|bibliothèque BetGPT|photo d[’']illustration|n[’']illustre pas une (?:action|scène)|ce n[’']est pas une photo/i;

describe("ASTRA public image copy guard", () => {
  it("scrubs production jargon from legacy alt text", () => {
    const alt = cleanPublicImageAlt(
      "Supporters pendant un match de football, photo d'illustration libre de droits",
    );
    assert.equal(alt, "Supporters pendant un match de football");
    assert.doesNotMatch(alt, INTERNAL_PUBLIC_JARGON);
  });

  it("builds a contextual football caption instead of a production disclaimer", () => {
    const article = {
      h1: "France – Italie : les clés du match",
      teams: ["France", "Italie"],
      competition: "Ligue des nations",
    } as EditorialArticle;
    const caption = editorialImageCaption(article);
    assert.equal(
      caption,
      "France – Italie en Ligue des nations : informations, contexte et analyse du match.",
    );
    assert.equal(containsInternalImageCopy(caption), false);
  });

  it("keeps the published editorial ledger free of internal image-production wording", () => {
    const ledger = readFileSync(new URL("../../../data/editorial/ledger.json", import.meta.url), "utf8");
    assert.doesNotMatch(ledger, INTERNAL_PUBLIC_JARGON);
  });
});
