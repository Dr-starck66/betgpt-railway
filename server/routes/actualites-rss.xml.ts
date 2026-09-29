import { defineEventHandler, setHeader } from "h3";
import { ensureLive } from "../../src/engine/live";
import type { MatchInput } from "../../src/engine/types";
import { buildEdition } from "../../src/lib/editorial/engine";
import { actualitesRss } from "../../src/lib/editorial/feed";

export default defineEventHandler(async (event) => {
  const live = await ensureLive().catch(() => null);
  const edition = buildEdition({ now: new Date(), matches: (live?.matches ?? []) as MatchInput[] });
  setHeader(event, "content-type", "application/rss+xml; charset=utf-8");
  setHeader(event, "cache-control", "public, max-age=600");
  return actualitesRss(edition.articles);
});
