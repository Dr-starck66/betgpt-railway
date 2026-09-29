/**
 * GET /api/go — 302 vers la page match Unibet/Betclic.
 * Vite dev + preview. Production: server/api/go.get.ts
 */
export function goApiPlugin() {
  const mount = (server) => {
    server.middlewares.use(async (req, res, next) => {
      const pathOnly = (req.url ?? "").split("?", 1)[0] ?? "";
      if (pathOnly !== "/api/go") {
        next();
        return;
      }
      if ((req.method ?? "GET").toUpperCase() !== "GET") {
        res.statusCode = 405;
        res.end("Method Not Allowed");
        return;
      }
      try {
        const host = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost:8080");
        const proto = String(
          req.headers["x-forwarded-proto"] ?? (req.socket?.encrypted ? "https" : "http"),
        );
        const request = new Request(`${proto}://${host}${req.url}`, { method: "GET" });
        const mod = await server.ssrLoadModule("/src/lib/go.server.ts");
        const response = await mod.handleGoRequest(request);
        res.statusCode = response.status;
        const loc = response.headers.get("location");
        if (loc) res.setHeader("location", loc);
        res.setHeader("cache-control", "no-store");
        const body = Buffer.from(await response.arrayBuffer());
        res.end(body);
      } catch (err) {
        console.error("[betgpt] /api/go failed:", err);
        if (!res.headersSent) {
          res.statusCode = 302;
          const raw = String(req.url ?? "");
          const u = new URL(raw, "http://localhost");
          const dest = u.searchParams.get("u") ?? "";
          if (/^https:\/\/(www\.)?(unibet|betclic|netbet|winamax|vbet)/i.test(dest)) {
            res.setHeader("location", dest);
            res.end();
            return;
          }
          res.statusCode = 404;
          res.end("Lien bookmaker introuvable");
        }
      }
    });
  };

  return {
    name: "calibre-go-api",
    configureServer(server) {
      mount(server);
    },
  };
}
