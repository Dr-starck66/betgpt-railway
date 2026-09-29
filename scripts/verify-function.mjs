import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Exercise exactly the function output, with no access through the source cwd.
process.env.BETGPT_OFFLINE = "1";
process.env.DATABASE_URL = "";
process.env.XAI_API_KEY = "";
process.env.RESEND_API_KEY = "";
process.env.VERCEL = "1";
const root = resolve(".vercel/output/functions/__server.func");
for (const asset of ["_libs/pglite.data", "_libs/pglite.wasm", "_libs/initdb.wasm", "data/archive-history.json", "data/live-snapshot.json"]) assert.ok(existsSync(resolve(root, asset)), `Missing runtime asset: ${asset}`);
process.chdir(root);
const { default: app } = await import(pathToFileURL(resolve(root, "index.mjs")).href);
const pending = [];
const context = { waitUntil: p => pending.push(p) };
for (const route of ["/robots.txt", "/sitemap.xml", "/chat", "/forum", "/"]) {
  const response = await app.fetch(new Request(`https://betgpt.live${route}`), context);
  const text = await response.text();
  assert.equal(response.status, 200, `${route}: ${text.slice(0, 300)}`);
  if (route === "/sitemap.xml") assert.match(text, /https:\/\/betgpt\.live\/match\//);
  if (route === "/chat") assert.match(text, /Ton message à BetGPT/);
  console.log(`Standalone function: ${route} HTTP 200 (${text.length} bytes)`);
}
const archive = JSON.parse(readFileSync(resolve(root, "data/archive-history.json"), "utf8"));
const rows = Array.isArray(archive) ? archive : archive.matches;
assert.ok(Array.isArray(rows) && rows.length > 100);
const response = await app.fetch(new Request("https://betgpt.live/api/chat", { method: "POST", headers: {"content-type":"application/json"}, body: JSON.stringify({messages:[{role:"user",content:"Quelles ligues ont le moins de 0-0 ?"}]}) }), context);
assert.equal(response.status, 200);
const answer = await response.json();
assert.match(answer.text, /Mode local/);
assert.match(answer.text, /Archive —/);
assert.match(answer.text, /sur \d+ matchs/);
console.log("Standalone chat: real archived counts, explicit local mode, HTTP 200");
await Promise.allSettled(pending);
console.log("Standalone function checks: PASS");
// The serverless bundle owns long-lived timers. All assertions and waitUntil
// work are finished; terminate this one-shot test instead of serving forever.
process.exit(0);
