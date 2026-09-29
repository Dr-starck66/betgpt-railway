/**
 * Dev: serve robots.txt + sitemaps. Preview/production use Nitro routes.
 */
export function seoPublicPlugin() {
  const files = new Set(["/robots.txt", "/sitemap.xml", "/sitemap-images.xml", "/news-sitemap.xml", "/llms.txt", "/changelog.json", "/evidence.json", "/evidence.csv"]);
  const mount = (server) => {
    server.middlewares.use(async (req, res, next) => {
      const pathOnly = (req.url ?? "").split("?", 1)[0] ?? "";
      if (!files.has(pathOnly)) {
        next();
        return;
      }
      if ((req.method ?? "GET").toUpperCase() !== "GET") {
        res.statusCode = 405;
        res.end("Method Not Allowed");
        return;
      }
      try {
        if (pathOnly === "/robots.txt") {
          const mod = await server.ssrLoadModule("/src/lib/robots.ts");
          res.statusCode = 200;
          res.setHeader("content-type", "text/plain; charset=utf-8");
          res.setHeader("x-content-type-options", "nosniff");
          res.end(mod.robotsTxt());
          return;
        }
        if (pathOnly === "/llms.txt") {
          const mod = await server.ssrLoadModule("/src/lib/geo/llms.ts");
          res.statusCode = 200;
          res.setHeader("content-type", "text/plain; charset=utf-8");
          res.end(mod.llmsTxt());
          return;
        }
        if (pathOnly === "/changelog.json") {
          const mod = await server.ssrLoadModule("/src/lib/geo/changelog.ts");
          res.statusCode = 200;
          res.setHeader("content-type", "application/json; charset=utf-8");
          res.end(JSON.stringify(mod.changelogDocument()));
          return;
        }
        if (pathOnly === "/evidence.json" || pathOnly === "/evidence.csv") {
          const tickets = await server.ssrLoadModule("/src/engine/ticket-log.ts");
          const evidence = await server.ssrLoadModule("/src/lib/geo/evidence-public.ts");
          const rows = tickets.loadTickets();
          res.statusCode = 200;
          if (pathOnly === "/evidence.csv") {
            res.setHeader("content-type", "text/csv; charset=utf-8");
            res.setHeader("content-disposition", 'attachment; filename="betgpt-evidence.csv"');
            res.end(evidence.evidenceCsv(rows));
            return;
          }
          res.setHeader("content-type", "application/json; charset=utf-8");
          res.end(JSON.stringify({
            note: "Extrait du registre. Les champs absents sont null. Aucun score n’est complété.",
            count: rows.length,
            items: evidence.publicEvidence(rows),
          }));
          return;
        }
        const sitemap = await server.ssrLoadModule("/src/lib/sitemap-urls.ts");
        if (pathOnly === "/news-sitemap.xml") {
          res.statusCode = 200;
          res.setHeader("content-type", "application/xml; charset=utf-8");
          res.setHeader("cache-control", "public, max-age=3600");
          res.end(sitemap.newsSitemapXml());
          return;
        }
        const urls = await sitemap.loadSitemapUrls();
        const xml = pathOnly === "/sitemap-images.xml" ? sitemap.sitemapImagesXml(urls) : sitemap.sitemapXml(urls);
        res.statusCode = 200;
        res.setHeader("content-type", "application/xml; charset=utf-8");
        res.setHeader("cache-control", "public, max-age=60, must-revalidate");
        res.end(xml);
      } catch (err) {
        console.error("[seo-public]", pathOnly, err);
        res.statusCode = 500;
        res.end("error");
      }
    });
  };
  return {
    name: "betgpt-seo-public",
    configureServer: mount,
  };
}
