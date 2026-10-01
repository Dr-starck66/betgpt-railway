#!/usr/bin/env node
import http from "node:http";
import https from "node:https";

const CANONICAL_UPSTREAM = new URL("https://betgpt-production-7353.up.railway.app");
const requestedUpstream = new URL(process.env.ASTRA_PUBLIC_UPSTREAM || CANONICAL_UPSTREAM.toString());

if (
  requestedUpstream.protocol !== CANONICAL_UPSTREAM.protocol ||
  requestedUpstream.host !== CANONICAL_UPSTREAM.host
) {
  console.error("ASTRA_PUBLIC_PROXY_FAIL_CLOSED", {
    requested: requestedUpstream.origin,
    required: CANONICAL_UPSTREAM.origin,
  });
  process.exit(78);
}

const upstream = CANONICAL_UPSTREAM;
const port = Number(process.env.PORT || 8080);

function proxy(req, res) {
  const headers = { ...req.headers };
  delete headers.connection;
  delete headers["proxy-connection"];
  delete headers.upgrade;
  headers.host = upstream.host;
  headers["x-forwarded-host"] = req.headers.host || "betgpt.live";
  headers["x-forwarded-proto"] = "https";

  const client = upstream.protocol === "https:" ? https : http;
  const upstreamReq = client.request(
    {
      protocol: upstream.protocol,
      hostname: upstream.hostname,
      port: upstream.port || (upstream.protocol === "https:" ? 443 : 80),
      method: req.method,
      path: req.url,
      headers,
    },
    (upstreamRes) => {
      const outHeaders = { ...upstreamRes.headers };
      outHeaders["x-astra-public-proxy"] = "betgpt-canonical-alias";
      outHeaders["x-astra-router-mode"] = "ROUTER_ONLY";
      res.writeHead(upstreamRes.statusCode || 502, outHeaders);
      upstreamRes.pipe(res);
    },
  );

  upstreamReq.on("error", (error) => {
    console.error("ASTRA_PUBLIC_PROXY_ERROR", error);
    if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    res.end("Public proxy upstream unavailable.");
  });

  req.pipe(upstreamReq);
}

http.createServer(proxy).listen(port, "0.0.0.0", () => {
  console.log("ASTRA_CANONICAL_ALIAS_READY", { port, upstream: upstream.toString(), mode: "ROUTER_ONLY" });
});
