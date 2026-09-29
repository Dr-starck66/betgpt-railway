/**
 * POST /api/chat — BetGPT stream. Vite dev + preview. Production: server/api/chat.post.ts
 */
export function chatApiPlugin() {
  const mount = (server) => {
    server.middlewares.use(async (req, res, next) => {
      const pathOnly = (req.url ?? "").split("?", 1)[0] ?? "";
      if (pathOnly !== "/api/chat") {
        next();
        return;
      }
      if ((req.method ?? "GET").toUpperCase() !== "POST") {
        res.statusCode = 405;
        res.setHeader("content-type", "text/plain; charset=utf-8");
        res.end("Method Not Allowed");
        return;
      }
      try {
        const chunks = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 65536) { res.statusCode = 413; res.end(JSON.stringify({ error: "Message trop volumineux." })); return; }
          chunks.push(chunk);
        }
        const raw = Buffer.concat(chunks);
        const host = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost:8080");
        const proto = String(
          req.headers["x-forwarded-proto"] ??
            (req.socket?.encrypted ? "https" : "http"),
        );
        const request = new Request(`${proto}://${host}/api/chat`, {
          method: "POST",
          headers: {
            "content-type": req.headers["content-type"] ?? "application/json",
          },
          body: raw,
        });
        const mod = await server.ssrLoadModule("/src/lib/chat/stream.server.ts");
        const response = await mod.handleChatRequest(request);
        res.statusCode = response.status;
        response.headers.forEach((value, key) => {
          res.setHeader(key, value);
        });
        if (!response.body) {
          res.end();
          return;
        }
        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(Buffer.from(value));
        }
        res.end();
      } catch (err) {
        console.error("[calibre] /api/chat failed:", err);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: "chat failed" }));
        } else {
          res.end();
        }
      }
    });
  };

  return {
    name: "calibre-chat-api",
    configureServer(server) {
      mount(server);
    },
  };
}
