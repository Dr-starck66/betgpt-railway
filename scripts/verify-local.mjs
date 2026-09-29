/** Run server and checks in one network namespace, without outbound delivery. */
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import assert from "node:assert/strict";

const production = process.argv.includes("--production");
const port = production ? 8081 : 8080;
const base = `http://127.0.0.1:${port}`;
const env = {
  ...process.env,
  BETGPT_OFFLINE: "1",
  DATABASE_URL: "",
  XAI_API_KEY: "",
  RESEND_API_KEY: "",
  SSR_SEO_BASE: base,
};
const args = production
  ? ["scripts/with-app-env.mjs", process.execPath, "node_modules/vite/bin/vite.js", "preview", "--host", "127.0.0.1", "--port", String(port)]
  : ["scripts/with-app-env.mjs", process.execPath, "node_modules/vite/bin/vite.js", "dev", "--host", "127.0.0.1", "--port", String(port)];
const server = spawn(process.execPath, args, { env, stdio: ["ignore", "pipe", "pipe"] });
let logs = "";
server.stdout.on("data", (chunk) => {
  logs = (logs + chunk).slice(-14000);
});
server.stderr.on("data", (chunk) => {
  logs = (logs + chunk).slice(-14000);
});
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error(`Server stopped (${server.exitCode}): ${logs}`);
    try {
      const response = await fetch(`${base}/robots.txt`, { signal: AbortSignal.timeout(1500) });
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      /* starting */
    }
    await delay(400);
  }
  assert.ok(ready, `Server did not become ready: ${logs}`);
  for (const path of ["/chat", "/blog", "/forum", "/"]) {
    const response = await fetch(base + path, { signal: AbortSignal.timeout(60000) });
    const html = await response.text();
    assert.equal(response.status, 200, `${path}: ${html.slice(0, 300)}`);
    assert.match(html, /<h1/);
    assert.match(html, /rel="canonical"/);
    console.log(`HTTP 200 + H1 + canonical: ${path} (${html.length} bytes)`);
  }
  const invalid = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "user", content: "   " }] }),
  });
  assert.equal(invalid.status, 400);
  console.log("Chat invalid input: HTTP 400");
  const started = Date.now();
  const valid = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: "Analyse Monaco" }],
      userMemory: { blackBook: null },
    }),
    signal: AbortSignal.timeout(20000),
  });
  assert.equal(valid.status, 200);
  const answer = await valid.json();
  assert.match(answer.text, /Mode local/);
  assert.match(answer.text, /Données disponibles/);
  console.log(`Chat local reply: HTTP 200, explicitly labeled, ${Date.now() - started} ms`);
  if (process.argv.includes("--all")) {
    const tests = spawn("npm", ["test"], { env, stdio: "inherit" });
    const code = await new Promise((resolve) => tests.on("exit", resolve));
    assert.equal(code, 0, "Test suite failed");
  }
  console.log(production ? "Production HTTP checks: PASS" : "Development HTTP checks: PASS");
} catch (error) {
  console.error(error);
  console.error(logs);
  process.exitCode = 1;
} finally {
  server.kill("SIGTERM");
}
