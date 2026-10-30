import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cityPsgEveningAgentCandidate20261030 as article } from "./manual-city-psg-evening-agent-candidate-2026-10-30.ts";
import { editorialGoldStandardGate } from "./gold-standard.ts";
import { inlineImageProof } from "./inline-image-proof.ts";
import { qualityGate } from "./quality.ts";

describe("City–PSG 2026-10-30 immutable unpublished agent candidate", () => {
  it("never claims native Qwen provenance or a public deployment", () => {
    assert.equal(article.status, "SCHEDULED");
    assert.equal(article.publishedAt, null);
    assert.equal(article.generationProof, undefined);
    assert.equal(article.discoverChecks.INDEXABLE, false);
    assert.equal(article.quality.pass, false, "candidate remains pending GREEN and postflight");
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
