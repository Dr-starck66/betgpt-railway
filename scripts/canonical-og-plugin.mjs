/**
 * Outer HTML wrapper: after grok-pwa injects grok.me OG tags, rewrite them to
 * betgpt.live so crawlers and share unfurls hit the canonical origin.
 */
import { rewriteCanonicalOg } from "./canonical-og.mjs";

function toBuffer(chunk, encoding) {
  if (chunk == null || typeof chunk === "function") return null;
  if (Buffer.isBuffer(chunk)) return chunk;
  if (typeof chunk === "string") {
    return Buffer.from(chunk, typeof encoding === "string" ? encoding : "utf8");
  }
  if (chunk instanceof Uint8Array) return Buffer.from(chunk);
  return Buffer.from(chunk);
}

function wrapHtml(middlewares) {
  middlewares.use((req, res, next) => {
    const method = (req.method ?? "GET").toUpperCase();
    const pathOnly = (req.url ?? "").split("?", 1)[0] ?? "";
    const accept = String(req.headers.accept ?? "");
    if (
      method !== "GET" ||
      !accept.includes("text/html") ||
      /\.(txt|xml|json|js|css|map|png|jpe?g|svg|ico|woff2?|webp)$/i.test(pathOnly)
    ) {
      next();
      return;
    }
    const originalEnd = res.end.bind(res);
    const chunks = [];
    res.write = (chunk, encoding, cb) => {
      const done = typeof encoding === "function" ? encoding : cb;
      const buf = toBuffer(chunk, encoding);
      if (buf) chunks.push(buf);
      if (typeof done === "function") done();
      return true;
    };
    res.end = (chunk, encoding, cb) => {
      let data = chunk;
      let enc = encoding;
      let done = cb;
      if (typeof data === "function") {
        done = data;
        data = undefined;
        enc = undefined;
      } else if (typeof enc === "function") {
        done = enc;
        enc = undefined;
      }
      const buf = toBuffer(data, enc);
      if (buf) chunks.push(buf);
      const raw = Buffer.concat(chunks).toString("utf8");
      const ctype = String(res.getHeader("content-type") ?? "");
      const encoded = Boolean(res.getHeader("content-encoding"));
      const out = ctype.includes("text/html") && !encoded ? rewriteCanonicalOg(raw) : raw;
      const body = Buffer.from(out, "utf8");
      if (!res.headersSent) {
        res.setHeader("content-length", String(body.byteLength));
      }
      return originalEnd(body, undefined, done);
    };
    next();
  });
}

export function canonicalOgPlugin() {
  return {
    name: "betgpt-canonical-og",
    configureServer(server) {
      wrapHtml(server.middlewares);
    },
    configurePreviewServer(server) {
      wrapHtml(server.middlewares);
    },
  };
}
