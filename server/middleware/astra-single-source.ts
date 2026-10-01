import { defineEventHandler, getRequestHost, proxyRequest, setHeader } from "h3";

function normalizedHost(raw: string): string {
  return raw.trim().toLowerCase().replace(/:\d+$/, "");
}

export default defineEventHandler(async (event) => {
  const canonicalOrigin = String(process.env.ASTRA_CANONICAL_ORIGIN || "").trim();
  const publicHosts = String(process.env.ASTRA_PUBLIC_HOSTS || "")
    .split(",")
    .map(normalizedHost)
    .filter(Boolean);

  if (!canonicalOrigin || !publicHosts.length) return;

  const host = normalizedHost(getRequestHost(event, { xForwardedHost: true }) || "");
  if (!publicHosts.includes(host)) return;

  const canonical = new URL(canonicalOrigin);
  if (normalizedHost(canonical.host) === host) return;

  const requestPath = event.node.req.url || "/";
  const target = new URL(requestPath, canonical).toString();

  setHeader(event, "x-astra-public-proxy", process.env.ASTRA_PUBLIC_PROXY_ID || "astra-canonical");

  return proxyRequest(event, target, {
    headers: {
      host: canonical.host,
      "x-forwarded-host": host,
      "x-forwarded-proto": "https",
      "x-astra-routed-by": process.env.ASTRA_PUBLIC_PROXY_ID || "astra-canonical",
    },
  });
});
