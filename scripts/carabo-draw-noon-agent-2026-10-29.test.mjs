import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const path = new URL("../src/lib/editorial/manual-carabao-draw-noon-agent-2026-10-29.ts", import.meta.url);
const raw = readFileSync(path, "utf8");
const article = JSON.parse(raw.slice(raw.indexOf(" = {") + 3, raw.lastIndexOf(";")).trim());

function audit(candidate) {
  const errors = [];
  const body = [candidate.lead, ...candidate.paragraphs.flatMap(p => [p.body, ...(p.subsections || []).map(s => s.body)])].join(" ");
  if (candidate.paragraphs.some(p => p.body.length >= 1200 && !(p.subsections || []).length)) errors.push("flat_heading_architecture");
  if (candidate.paragraphs.some(p => (p.subsections || []).some(s => !s.sourceIds?.length))) errors.push("uncited_subsection");
  const words = body.split(/\s+/u).filter(Boolean).length;
  if (words < 1500) errors.push("under_1500_words");
  if (candidate.paragraphs.length < 7) errors.push("under_7_sections");
  if (new Set(candidate.paragraphs.map(p => p.h2.toLocaleLowerCase("fr"))).size !== candidate.paragraphs.length) errors.push("duplicate_h2");
  const ids = new Set(candidate.sources.map(s => s.id));
  if (candidate.paragraphs.some(p => !p.sourceIds?.length || p.sourceIds.some(id => !ids.has(id)))) errors.push("unattributed_section");
  const hosts = new Set(candidate.sources.map(s => new URL(s.url).hostname.replace(/^www\./, "")));
  if (hosts.size < 4 || !candidate.sources.some(s => s.status === "OFFICIAL")) errors.push("insufficient_independent_sources");
  const inline = candidate.paragraphs.flatMap((p, i) => p.inlineImage ? [{...p.inlineImage, section:i}] : []);
  if (inline.length < 2 || new Set(inline.map(x => x.section)).size < 2) errors.push("missing_inline_images");
  if (new Set([candidate.image.src, ...inline.map(x => x.src)]).size !== inline.length + 1) errors.push("image_reuse");
  if (inline.some(x => x.width < 1200 || x.height < 675 || !x.alt || !x.caption || !x.credit || !x.sourceUrl || !x.licenseUrl)) errors.push("invalid_image_metadata");
  if (candidate.generationProof) errors.push("false_native_provenance");
  if (candidate.parisDate !== "2026-10-29" || candidate.slot !== "noon" || candidate.id.startsWith("ed-")) errors.push("bad_slot");
  if (candidate.status !== "PUBLISHED" || !Number.isFinite(Date.parse(candidate.publishedAt)) || !candidate.quality.pass) errors.push("unapproved_publication");
  return { words, errors };
}
test("noon agent source is documented and approved for protected publication", () => {
  const result = audit(article);
  assert.deepEqual(result.errors, []);
  assert.ok(result.words >= 1500);
});
test("reject candidate missing second inline image", () => {
  const broken = structuredClone(article);
  delete broken.paragraphs[2].inlineImage;
  assert.ok(audit(broken).errors.includes("missing_inline_images"));
});
test("reject false Qwen provenance", () => {
  const broken = structuredClone(article);
  broken.generationProof = { generator:"astra-auto-reporter-v2", modelRequests:7 };
  assert.ok(audit(broken).errors.includes("false_native_provenance"));
});
test("reject unapproved publication status", () => {
  const broken = structuredClone(article);
  broken.status = "SCHEDULED";
  assert.ok(audit(broken).errors.includes("unapproved_publication"));
});
