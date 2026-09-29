import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Vercel build copies every PGlite runtime asset beside the bundled module", () => {
  const vite = read("vite.config.ts");
  assert.match(vite, /pgliteVercelAssetsPlugin/);
  for (const asset of ["pglite.data", "pglite.wasm", "initdb.wasm"]) {
    assert.match(vite, new RegExp(asset.replace(".", "\\.")));
  }
  assert.match(vite, /"__server\.func",\s*"_libs"/s);
  assert.match(vite, /copyFileSync/);
});

test("auth-off imports cannot create an unhandled PGlite bootstrap rejection", () => {
  const auth = read("src/lib/auth/server.ts");
  assert.match(auth, /if \(!authDisabled\) \{/);
  assert.match(auth, /ensureDbReady\(\)\.catch/);
});

test("expired live forum threads fall back to the immutable match archive", () => {
  const desk = read("src/lib/desk.functions.ts");
  const route = read("src/routes/forum.$threadId.tsx");
  assert.match(desk, /resolveStoredMatch\(data\.id\)/);
  assert.match(desk, /buildForum\(\[stored\.match\], \[stored\.prediction\]\)/);
  assert.match(route, /statusCode: 301/);
});

test("sitemaps escape URLs and news entries are restricted to the last 48 hours", () => {
  const sitemap = read("src/lib/sitemap-urls.ts");
  assert.match(sitemap, /<loc>\$\{escXml\(u\.loc\)\}<\/loc>/);
  assert.match(sitemap, /48 \* 60 \* 60 \* 1000/);
  assert.match(sitemap, /published >= cutoff && published <= now/);
});

test("startup leaves an already healthy dev server untouched", () => {
  const startup = read("startup.sh");
  const health = startup.indexOf("curl -sf");
  const stop = startup.indexOf("preview.mjs stop");
  assert.ok(health >= 0 && stop > health);
});
