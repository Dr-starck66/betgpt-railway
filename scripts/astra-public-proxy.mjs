#!/usr/bin/env node
import http from "node:http";
import https from "node:https";

const upstream = new URL(process.env.ASTRA_PUBLIC_UPSTREAM || "https://betgpt-production-7353.up.railway.app");
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
      outHeaders["x-astra-public-proxy"] = "betgpt-main";
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
  console.log("ASTRA_PUBLIC_PROXY_READY", { port, upstream: upstream.toString() });
});
