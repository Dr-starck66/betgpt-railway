import { defineEventHandler, setHeader } from "h3";
import { loadSitemapUrls, sitemapImagesXml } from "../../src/lib/sitemap-urls";

export default defineEventHandler(async (event) => {
  const urls = await loadSitemapUrls();
  setHeader(event, "content-type", "application/xml; charset=utf-8");
  setHeader(event, "cache-control", "public, max-age=60, must-revalidate");
  return sitemapImagesXml(urls);
});
