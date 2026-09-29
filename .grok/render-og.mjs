import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { extname, join } from "node:path";

const ROOT = "/workspace/.grok";
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".css": "text/css",
};

const server = createServer((req, res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  const rel = url.pathname === "/" ? "/og-card.html" : url.pathname;
  const file = join(ROOT, rel);
  if (!file.startsWith(ROOT) || !existsSync(file)) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
  res.end(readFileSync(file));
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();
const origin = `http://127.0.0.1:${port}`;

const browser = await chromium.launch({ args: ["--disable-web-security"] });
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 2,
});
await page.goto(`${origin}/og-card.html`, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await new Promise((r) => setTimeout(r, 250));
await page.screenshot({
  path: join(ROOT, "og-comp.png"),
  type: "png",
  clip: { x: 0, y: 0, width: 1200, height: 630 },
});

const preview = await browser.newPage({
  viewport: { width: 420, height: 180 },
  deviceScaleFactor: 2,
});
await preview.goto(`${origin}/favicon-preview.html`, { waitUntil: "networkidle" });
await preview.screenshot({ path: join(ROOT, "favicon-preview.png") });

await browser.close();
server.close();
console.log("rendered", origin);
