import { readFileSync, writeFileSync } from "node:fs";
import { sourceIntegrityGate } from "../src/lib/editorial/source-integrity.ts";
import { contextualAuthorityGate } from "../src/lib/editorial/authority-citations.ts";
import { editorialGoldStandardGate } from "../src/lib/editorial/gold-standard.ts";
import { parisDate } from "../src/lib/editorial/time.ts";
import { isPublicArticle, type EditorialArticle } from "../src/lib/editorial/types.ts";

const URL = process.env.BETGPT_EDITORIAL_SNAPSHOT_URL || "https://betgpt.live/api/editorial-snapshot";
const PATH = "data/editorial/ledger.json";
const now = new Date();
let remote: { schema?: string; generatedAt?: string; articles?: EditorialArticle[] };
try {
  const response = await fetch(URL, { signal: AbortSignal.timeout(12000), headers: { accept: "application/json" } });
  if (!response.ok) throw new Error("HTTP " + response.status);
  remote = await response.json() as typeof remote;
  if (remote.schema !== "betgpt-editorial-live-snapshot/v1" || !Array.isArray(remote.articles)) {
    throw new Error("unexpected snapshot schema");
  }
  if (!remote.generatedAt || Math.abs(now.getTime() - Date.parse(remote.generatedAt)) > 15 * 60000) {
    throw new Error("stale or invalid snapshot time");
  }
} catch (error) {
  console.warn("ASTRA_EDITORIAL_LIVE_SNAPSHOT_UNAVAILABLE", String(error));
  process.exit(0); // Never replace durable content when production is unreachable.
}

const stored = JSON.parse(readFileSync(PATH, "utf8")) as EditorialArticle[];
if (!Array.isArray(stored)) throw new Error("invalid local editorial ledger");
const ids = new Map(stored.map((item, idx) => [item.id, idx] as const));
const knownSlugs = new Map(stored.map((item) => [item.slug, item.id] as const));
const today = parisDate(now);
let imported = 0, unchanged = 0, rejected = 0;
for (const article of remote.articles ?? []) {
  if (!article || !isPublicArticle(article) || !/^ed-\d{4}-\d{2}-\d{2}-(morning|noon|evening)$/.test(article.id)) { rejected++; continue; }
  if (article.id !== `ed-${article.parisDate}-${article.slot}` || !article.publishedAt || !article.modifiedAt) { rejected++; continue; }
  const publishedMs = Date.parse(article.publishedAt);
  if (!Number.isFinite(publishedMs) || publishedMs > now.getTime() + 5 * 60000 ||
      now.getTime() - publishedMs > 72 * 3600000 || parisDate(new Date(publishedMs)) !== article.parisDate) { rejected++; continue; }
  if (article.parisDate > today || !article.slug || knownSlugs.has(article.slug) && knownSlugs.get(article.slug) !== article.id) { rejected++; continue; }
  if (article.quality?.pass !== true ||
      !editorialGoldStandardGate(article).pass ||
      !contextualAuthorityGate(article).pass ||
      !sourceIntegrityGate(article).pass) { rejected++; continue; }
  if (article.sources.filter((s) => s.url?.startsWith("https://")).length < 3) { rejected++; continue; }
  const index = ids.get(article.id);
  if (index != null) {
    const old = stored[index]!;
    if (old.slug !== article.slug || (old.modifiedAt ?? "") >= article.modifiedAt) { unchanged++; continue; }
    stored[index] = article;
  } else {
    ids.set(article.id, stored.length);
    knownSlugs.set(article.slug, article.id);
    stored.push(article);
  }
  imported++;
}
if (imported > 0) writeFileSync(PATH, JSON.stringify(stored, null, 2) + "\n");
console.info("ASTRA_EDITORIAL_LIVE_SNAPSHOT_SYNC", JSON.stringify({ imported, unchanged, rejected, archiveCount: stored.length, generatedAt: remote.generatedAt }));
