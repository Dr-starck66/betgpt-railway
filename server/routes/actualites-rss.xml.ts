import { defineEventHandler, setHeader } from "h3";
import { editionFromDesk } from "../../src/lib/editorial/run.server";
import { actualitesRss } from "../../src/lib/editorial/feed";

export default defineEventHandler(async (event) => {
  const { edition } = await editionFromDesk(new Date());
  setHeader(event, "content-type", "application/rss+xml; charset=utf-8");
  setHeader(event, "cache-control", "public, max-age=600");
  return actualitesRss(edition.articles);
});
