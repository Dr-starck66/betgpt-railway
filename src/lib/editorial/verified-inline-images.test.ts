import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { attachVerifiedInlineImages } from "./verified-inline-images.ts";
import { inlineImageProof } from "./inline-image-proof.ts";
import type { EditorialParagraph } from "./types.ts";

const paragraphs = (): EditorialParagraph[] => Array.from({ length: 7 }, (_, index) => ({
  h2: "Section " + (index + 1),
  body: "Texte factuel",
}));
const sources = [
  "Bayern Munich vs Real Madrid women: UEFA Women's Champions League preview",
  "FC Bayern Women face Real Madrid in Unterhaching",
];
describe("verified inline archive images for a single event", () => {
  it("attaches two distinct licensed photos in different H2 sections, never the cover", () => {
    const result = attachVerifiedInlineImages(paragraphs(), "Bayern Munich - Real Madrid : Ligue des champions féminine", sources, "2026-10-28");
    assert.equal(result.filter((p) => p.inlineImage).length, 2);
    assert.equal(result[1]?.inlineImage?.width, 1498);
    assert.equal(result[4]?.inlineImage?.width, 6546);
    assert.match(result[1]?.inlineImage?.caption ?? "", /1998/);
    assert.match(result[4]?.inlineImage?.caption ?? "", /pas ici/);
    assert.equal(inlineImageProof({ image: {src:"/cover.jpg",alt:"Cover",width:1200,height:675,credit:"Test"}, paragraphs:result }).pass, true);
  });
  it("does not attach photos to another match or another day", () => {
    assert.equal(attachVerifiedInlineImages(paragraphs(), "Chelsea - Arsenal", sources, "2026-10-28").some((p) => p.inlineImage), false);
    assert.equal(attachVerifiedInlineImages(paragraphs(), "Bayern - Real Madrid", sources, "2026-10-29").some((p) => p.inlineImage), false);
  });
  it("rejects a same-club story without two source headlines confirming women's context", () => {
    const result = attachVerifiedInlineImages(paragraphs(), "Bayern - Real Madrid", ["Bayern - Real Madrid men", sources[0]!], "2026-10-28");
    assert.equal(result.some((p) => p.inlineImage), false);
  });
  it("never mutates model sections", () => {
    const input = paragraphs();
    attachVerifiedInlineImages(input, "Bayern - Real Madrid", sources, "2026-10-28");
    assert.equal(input.some((p) => p.inlineImage), false);
  });
  it("adds two verified distinct archive photos for Arsenal women–Benfica on 29 October", () => {
    const titles = [
      "Arsenal Women 3-0 Benfica Women: Alessia Russo hat-trick",
      "Arsenal v Benfica Women's Champions League match report",
      "Benfica Arsenal women match report",
    ];
    const result = attachVerifiedInlineImages(paragraphs(), "Arsenal féminin 3-0 Benfica : le triplé de Russo", titles, "2026-10-29");
    assert.equal(result.filter((p) => p.inlineImage).length, 2);
    assert.equal(result[1]?.inlineImage?.width, 4480);
    assert.equal(result[4]?.inlineImage?.width, 1920);
    assert.match(result[1]?.inlineImage?.caption ?? "", /2024/);
    assert.match(result[4]?.inlineImage?.caption ?? "", /2022/);
    assert.equal(inlineImageProof({ image: {src:"/cover.jpg",alt:"Cover",width:1200,height:675,credit:"Test"}, paragraphs:result }).pass, true);
  });
  it("rejects wrong day, insufficient independent titles and unrelated match", () => {
    const titles = ["Arsenal Women 3-0 Benfica Women", "Arsenal Benfica women's match report"];
    assert.equal(attachVerifiedInlineImages(paragraphs(), "Arsenal - Benfica", titles, "2026-10-28").some((p) => p.inlineImage), false);
    assert.equal(attachVerifiedInlineImages(paragraphs(), "Arsenal - Benfica", [titles[0]!], "2026-10-29").some((p) => p.inlineImage), false);
    assert.equal(attachVerifiedInlineImages(paragraphs(), "Arsenal - Chelsea", titles, "2026-10-29").some((p) => p.inlineImage), false);
  });
});
