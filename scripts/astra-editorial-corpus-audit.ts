import { readFileSync } from "node:fs";
import { contextualAuthorityGate } from "../src/lib/editorial/authority-citations.ts";
import { sourceIntegrityGate } from "../src/lib/editorial/source-integrity.ts";
import { editorialGoldStandardGate, GOLD_STANDARD_REFERENCE_SLUG } from "../src/lib/editorial/gold-standard.ts";
import { manualEditorialArticles } from "../src/lib/editorial/manual-articles.ts";
import { isPublicArticle, type EditorialArticle } from "../src/lib/editorial/types.ts";

function readLedger(): EditorialArticle[] {
  try {
    const parsed = JSON.parse(readFileSync("data/editorial/ledger.json", "utf8")) as EditorialArticle[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const byId = new Map<string, EditorialArticle>();
for (const article of readLedger()) byId.set(article.id, article);
for (const article of manualEditorialArticles()) byId.set(article.id, article);

const published = [...byId.values()].filter(isPublicArticle);

const standard = published.find((article) => article.slug === GOLD_STANDARD_REFERENCE_SLUG);
if (!standard) {
  console.error("ASTRA_EDITORIAL_GOLD_STANDARD_FAIL reference article missing from corpus");
  process.exit(1);
}
const gold = editorialGoldStandardGate(standard);
const thinControl = editorialGoldStandardGate({ ...standard, paragraphs: standard.paragraphs.slice(0, 2) });
const unprovenControl = editorialGoldStandardGate({ ...standard, sources: standard.sources.slice(0, 1) });
if (!gold.pass || thinControl.pass || unprovenControl.pass) {
  console.error("ASTRA_EDITORIAL_GOLD_STANDARD_FAIL " + JSON.stringify({
    reference: gold,
    thinMustFail: !thinControl.pass,
    unprovenMustFail: !unprovenControl.pass,
  }));
  process.exit(1);
}
console.log(`ASTRA_EDITORIAL_GOLD_STANDARD_PASS reference=${standard.slug} words=${gold.words} sections=${gold.sections} fail_closed=true`);

const slugCounts = new Map<string, number>();
for (const article of published) slugCounts.set(article.slug, (slugCounts.get(article.slug) ?? 0) + 1);
const duplicateSlugs = [...slugCounts.entries()].filter(([, count]) => count > 1);
if (duplicateSlugs.length) {
  for (const [slug, count] of duplicateSlugs) {
    console.error(`ASTRA_EDITORIAL_DUPLICATE_SLUG_FAIL ${slug}: count=${count}`);
  }
  process.exit(1);
}

const integrityFailures = published
  .map((article) => ({ article, gate: sourceIntegrityGate(article) }))
  .filter(({ gate }) => !gate.pass);

if (integrityFailures.length) {
  for (const { article, gate } of integrityFailures) {
    console.error(`ASTRA_NEWS_SOURCE_INTEGRITY_CORPUS_FAIL ${article.slug}: ${gate.reasons.join(" | ")}`);
  }
  process.exit(1);
}

const failures = published
  .map((article) => ({ article, gate: contextualAuthorityGate(article) }))
  .filter(({ gate }) => !gate.pass);

if (failures.length) {
  for (const { article, gate } of failures) {
    console.error(`ASTRA_EDITORIAL_CORPUS_FAIL ${article.slug}: ${gate.reasons.join(" | ")}`);
  }
  process.exit(1);
}

console.log(
  `ASTRA_EDITORIAL_CORPUS_PASS audited=${published.length} historical_and_current=true fail_closed=true`,
);
