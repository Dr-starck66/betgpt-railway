import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const file = new URL("../src/lib/editorial/manual-carabao-noon-agent-2026-10-29.ts", import.meta.url);
const raw = readFileSync(file, "utf8");
const article = JSON.parse(raw.slice(raw.indexOf(" = {") + 3, raw.lastIndexOf(";")).trim());
const audit = (candidate) => {
  const reasons = [];
  const words = [candidate.lead, ...candidate.paragraphs.flatMap((p) => [p.body, ...(p.subsections ?? []).map((s) => s.body)])].join(" ").split(/\s+/u).filter(Boolean).length;
  if (words < 1500) reasons.push("under_1500_words");
  if (candidate.paragraphs.length < 7) reasons.push("under_7_h2");
  if (new Set(candidate.paragraphs.map((p) => p.h2.toLocaleLowerCase("fr"))).size !== candidate.paragraphs.length) reasons.push("duplicate_h2");
  const sources = new Set(candidate.sources.map((s) => s.id));
  if (candidate.paragraphs.some((p) => !p.sourceIds?.length || p.sourceIds.some((id) => !sources.has(id)) || p.subsections?.some((s) => !s.sourceIds?.length || s.sourceIds.some((id) => !sources.has(id)))) reasons.push("missing_direct_citations");
  if (!candidate.sources.some((s) => s.status === "OFFICIAL") || new Set(candidate.sources.filter((s) => s.status === "HIGH_CONFIDENCE").map((s) => new URL(s.url).hostname)).size < 3) reasons.push("insufficient_independent_publishers");
  const inline = candidate.paragraphs.flatMap((p, index) => p.inlineImage ? [{...p.inlineImage,index}] : []);
  if (inline.length !== 2 || new Set(inline.map((x) => x.index)).size !== 2) reasons.push("missing_two_in_body_images");
  if (new Set([candidate.image.src, ...inline.map((x) => x.src)]).size !== 3) reasons.push("duplicate_cover_or_inline_image");
  if (inline.some((x) => x.width < 1200 || x.height < 675 || x.width/x.height < 1.45 || x.width/x.height > 2.05 || !x.alt || !x.caption || !x.credit || !x.sourceUrl || !x.licenseUrl)) reasons.push("invalid_image_metadata");
  if (candidate.generationProof) reasons.push("agent_claims_native_qwen");
  return {words,reasons};
};
test("noon Carabao article meets structural and provenance minimum before protected deployment", () => {
  const result = audit(article);
  assert.deepEqual(result.reasons, []);
  assert.ok(result.words >= 1500);
  assert.equal(article.status,"PUBLISHED");
  assert.ok(Number.isFinite(Date.parse(article.publishedAt)));
  assert.equal(article.quality.pass,true);
  assert.equal(article.discoverOpportunity.decision,"PUBLISH");
  assert.equal(article.slot,"noon");
  assert.equal(article.parisDate,"2026-10-29");
  assert.ok(!article.generationProof);
});
test("noon Carabao candidate fails when inline image missing", () => {
  const a=structuredClone(article); delete a.paragraphs[1].inlineImage;
  assert.ok(audit(a).reasons.includes("missing_two_in_body_images"));
});
test("noon Carabao candidate fails if third independent publisher is removed", () => {
  const a=structuredClone(article); a.sources=a.sources.filter((s)=>s.id!=="goal");
  assert.ok(audit(a).reasons.includes("insufficient_independent_publishers"));
});
test("noon Carabao candidate fails when word count falls below 1500", () => {
  const a=structuredClone(article); for (const p of a.paragraphs) {p.body="Bref.";p.subsections=[];}
  assert.ok(audit(a).reasons.includes("under_1500_words"));
});
test("noon Carabao candidate rejects forged native generation proof", () => {
  const a=structuredClone(article);a.generationProof={generator:"astra-auto-reporter-v2",modelRequests:7};
  assert.ok(audit(a).reasons.includes("agent_claims_native_qwen"));
});
test("noon Carabao candidate rejects 4:3 inline image even if licensed", () => {
  const a=structuredClone(article);a.paragraphs[1].inlineImage.width=4320;a.paragraphs[1].inlineImage.height=3240;
  assert.ok(audit(a).reasons.includes("invalid_image_metadata"));
});
