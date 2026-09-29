import { defineEventHandler, setHeader } from "h3";
import { loadSitemapUrls, sitemapHtml } from "../../src/lib/sitemap-urls";

export default defineEventHandler(async (event) => {
  const urls = await loadSitemapUrls();
  setHeader(event, "content-type", "text/html; charset=utf-8");
  setHeader(event, "cache-control", "public, max-age=60, must-revalidate");
  return sitemapHtml(urls);
});
