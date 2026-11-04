import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cityPsgEveningAgentCandidate20261030 as article } from "./manual-city-psg-evening-agent-candidate-2026-10-30.ts";
import { editorialGoldStandardGate } from "./gold-standard.ts";
import { inlineImageProof } from "./inline-image-proof.ts";
import { qualityGate } from "./quality.ts";

describe("City–PSG 2026-10-30 immutable scheduled-agent fallback candidate", () => {
  it("records the real agent catch-up timestamp without native Qwen provenance", () => {
    assert.equal(article.status, "PUBLISHED");
    assert.ok(article.publishedAt?.startsWith("2026-10-30T21:"), "catch-up timestamp is after the nominal slot, not backdated");
    assert.equal(article.generationProof, undefined, "agent fallback must not masquerade as Qwen");
    assert.ok(article.corrections.some((c) => c.note.includes("aa7a05e1-c540-832b-80fb-475823c96263")), "real scheduled agent run ID required");
    assert.equal(article.discoverChecks.INDEXABLE, true);
    assert.equal(article.quality.pass, true, "quality pass is established by unchanged source gates; public postflight remains separate");
  });

  it("meets the unchanged editorial Gold Standard without padding", () => {
    const result = editorialGoldStandardGate(article);
    assert.equal(result.pass, true, JSON.stringify(result.reasons));
    assert.ok(result.words >= 1500);
    assert.ok(result.sections >= 7);
    assert.ok(result.independentlySourcedSections >= 7);
  });

  it("has two distinct licensed landscape illustrations inside two sections", () => {
    const result = inlineImageProof(article);
    assert.equal(result.pass, true, JSON.stringify(result.reasons));
    assert.equal(result.count, 2);
    for (const image of article.paragraphs.flatMap((p) => p.inlineImage ? [p.inlineImage] : [])) {
      assert.ok(image.caption?.includes("2015"));
      assert.ok(image.credit.includes("Espandero"));
      assert.ok(image.width >= 1200);
      assert.ok(image.width / image.height >= 1.45 && image.width / image.height <= 2.05);
    }
  });

  it("meets the unchanged existing content quality gate before any promotion", () => {
    const result = qualityGate(article, []);
    assert.equal(result.pass, true, JSON.stringify(result.reasons));
  });
});
