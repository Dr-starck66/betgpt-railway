import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
const path = new URL("../src/lib/editorial/manual-arsenal-benfica-morning-agent-2026-10-29.ts", import.meta.url);
const raw = readFileSync(path, "utf8");
const article = JSON.parse(raw.slice(raw.indexOf(" = {") + 3, raw.lastIndexOf(";")).trim());
function audit(candidate) {
  const reasons = [];
  const text = [candidate.lead, ...candidate.paragraphs.flatMap((p) => [p.body, ...(p.subsections || []).map((s) => s.body)])].join(" ");
  const words = text.split(/\s+/u).filter(Boolean).length;
  if (words < 1500) reasons.push("under_1500_words");
  if (candidate.paragraphs.length < 7) reasons.push("under_7_sections");
  if (new Set(candidate.paragraphs.map((p) => p.h2.toLocaleLowerCase("fr"))).size !== candidate.paragraphs.length) reasons.push("duplicate_h2");
  const sourceIds = new Set(candidate.sources.map((s) => s.id));
  if (candidate.paragraphs.some((p) => !p.sourceIds?.length || p.sourceIds.some((id) => !sourceIds.has(id)) || p.subsections?.some((s) => !s.sourceIds?.length || s.sourceIds.some((id) => !sourceIds.has(id)))) reasons.push("unattributed_sections");
  if (new Set(candidate.sources.map((s) => new URL(s.url).hostname)).size < 4 || !candidate.sources.some((s) => s.status === "OFFICIAL")) reasons.push("insufficient_sources");
  const inline = candidate.paragraphs.flatMap((p, index) => p.inlineImage ? [{...p.inlineImage, index}] : []);
  if (inline.length < 2 || new Set(inline.map((x) => x.index)).size < 2) reasons.push("missing_inline_images");
  if (new Set([candidate.image.src, ...inline.map((x) => x.src)]).size !== inline.length + 1) reasons.push("duplicate_or_cover_image");
  if (inline.some((x) => x.width < 1200 || x.height < 675 || !x.caption || !x.alt || !x.credit || !x.sourceUrl || !x.licenseUrl)) reasons.push("invalid_image_proof");
  if (candidate.generationProof) reasons.push("agent_must_not_claim_native_proof");
  if (candidate.parisDate !== "2026-10-29" || candidate.slot !== "morning" || candidate.id.startsWith("ed-")) reasons.push("bad_slot_provenance");
  return { words, reasons };
}
test("2026-10-29 morning agent candidate preserves 1500 words, seven cited H2 and two licensed inline images", () => {
  const result = audit(article);
  assert.equal(result.reasons.length, 0, result.reasons.join(","));
  assert.ok(result.words >= 1500);
  assert.equal(article.quality.pass, false, "candidate must not masquerade as production GREEN");
  assert.equal(article.status, "SCHEDULED");
  assert.equal(article.publishedAt, null);
});
test("agent candidate is rejected if one inline image disappears", () => {
  const candidate = structuredClone(article);
  delete candidate.paragraphs[1].inlineImage;
  assert.ok(audit(candidate).reasons.includes("missing_inline_images"));
});
test("agent candidate is rejected if native generation proof is forged", () => {
  const candidate = structuredClone(article);
  candidate.generationProof = {generator:"astra-auto-reporter-v2",modelRequests:7};
  assert.ok(audit(candidate).reasons.includes("agent_must_not_claim_native_proof"));
});
test("agent candidate is rejected if body is shortened below 1500 words", () => {
  const candidate = structuredClone(article);
  for (const p of candidate.paragraphs) {p.body="Bref.";p.subsections=[{h3:"Faits",body:"Bref.",sourceIds:["uefa"]}];}
  assert.ok(audit(candidate).reasons.includes("under_1500_words"));
});
