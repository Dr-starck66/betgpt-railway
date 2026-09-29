/**
 * Outer Nitro middleware: rewrite grok.me share tags to https://betgpt.live
 * after grok-pwa injects them. Filename sorts before grok-pwa.ts so this
 * wrapper is outer (runs on the way out).
 */
import { rewriteCanonicalOg } from "../../scripts/canonical-og.mjs";

interface SeoEvent {
  url: URL;
  req: { method: string; headers: Headers };
}

export default async function canonicalOgMiddleware(
  event: SeoEvent,
  next: () => unknown | Promise<unknown>,
): Promise<unknown> {
  const method = (event.req.method ?? "GET").toUpperCase();
  if (method !== "GET") return next();
  const result = await next();
  if (!(result instanceof Response)) return result;
  const ctype = result.headers.get("content-type") ?? "";
  if (!ctype.includes("text/html") || !result.body) return result;
  const html = await result.text();
  const out = rewriteCanonicalOg(html);
  const headers = new Headers(result.headers);
  headers.delete("content-length");
  return new Response(out, { status: result.status, statusText: result.statusText, headers });
}
