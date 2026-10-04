import { defineEventHandler, setHeader } from "h3";
import { hydrateLiveFromDisk } from "../../src/engine/live";
import type { MatchInput } from "../../src/engine/types";
import { buildEdition } from "../../src/lib/editorial/engine";
import { newsEntries } from "../../src/lib/editorial/feed";
import { readLedger } from "../../src/lib/editorial/ledger-store";
import { manualEditorialArticles } from "../../src/lib/editorial/manual-articles";
import { newsSitemapXml } from "../../src/lib/sitemap-urls";

export default defineEventHandler((event) => {
  // Google News crawl infrastructure must never wait on providers, DB writes,
  // or live news scouting. Build from durable/local editorial evidence only.
  const now = new Date();
  const live = hydrateLiveFromDisk();
  const matches = (live?.matches ?? []) as MatchInput[];
  const seeded = manualEditorialArticles();
  const seededIds = new Set(seeded.map((article) => article.id));
  const frozen = [...seeded, ...readLedger().filter((article) => !seededIds.has(article.id))];
  const edition = buildEdition({ now, matches, frozen });

  setHeader(event, "content-type", "application/xml; charset=utf-8");
  setHeader(event, "cache-control", "public, max-age=600, stale-while-revalidate=3600");
  return newsSitemapXml(now.getTime(), newsEntries(edition));
});
