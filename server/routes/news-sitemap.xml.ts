import { defineEventHandler, setHeader } from "h3";
import { editionFromDesk } from "../../src/lib/editorial/run.server";
import { newsEntries } from "../../src/lib/editorial/feed";
import { newsSitemapXml } from "../../src/lib/sitemap-urls";

export default defineEventHandler(async (event) => {
  const { edition } = await editionFromDesk(new Date());
  setHeader(event, "content-type", "application/xml; charset=utf-8");
  setHeader(event, "cache-control", "public, max-age=600");
  return newsSitemapXml(Date.now(), newsEntries(edition));
});
