#!/usr/bin/env node
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";

const repo = process.env.ASTRA_SYNC_REPO || "Dr-starck66/betgpt-railway";
const branch = process.env.ASTRA_SYNC_BRANCH || "main";
const pollMs = Math.max(30_000, Number(process.env.ASTRA_SYNC_POLL_MS || 60_000));
const publicPort = Number(process.env.PORT || 8080);
const healthPath = process.env.ASTRA_SYNC_HEALTH_PATH || "/api/health";
const installCommand =
  process.env.ASTRA_SYNC_BUILD_COMMAND ||
  "npm ci --include=dev --no-audit --no-fund && npm run test:results-watchdog && npm run build";
const startCommand = process.env.ASTRA_SYNC_START_COMMAND || "npm start";
const baseDir = process.env.ASTRA_SYNC_DIR || "/tmp/astra-public-sync";
const apiUrl = `https://api.github.com/repos/${repo}/commits/${encodeURIComponent(branch)}`;

let active = null;
let updateInFlight = false;
let nextPort = 19081;

function log(event, data = {}) {
  console.log("ASTRA_PUBLIC_SYNC", JSON.stringify({ at: new Date().toISOString(), event, ...data }));
}

async function resolveHead() {
  const response = await fetch(apiUrl, {
    headers: {
      "user-agent": "ASTRA-PUBLIC-SYNC/1.0",
      accept: "application/vnd.github+json",
      "cache-control": "no-cache",
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`GitHub head lookup failed: HTTP ${response.status}`);
  const data = await response.json();
  const sha = String(data.sha || "").trim();
  if (!/^[a-f0-9]{40}$/i.test(sha)) throw new Error("GitHub returned an invalid revision");
  return sha;
}

function runShell(command, cwd, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn("bash", ["-lc", command], {
      cwd,
      env,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed code=${code} signal=${signal || "none"}: ${command}`));
    });
  });
}

async function prepareRevision(sha) {
  const dir = path.join(baseDir, sha);
  if (fs.existsSync(path.join(dir, ".astra-ready"))) return dir;

  const staging = `${dir}.staging`;
  fs.rmSync(staging, { recursive: true, force: true });
  fs.mkdirSync(staging, { recursive: true });

  const archive = `https://codeload.github.com/${repo}/tar.gz/${sha}`;
  log("download", { sha, archive });
  await runShell(
    `curl -fL --retry 4 --retry-delay 2 --connect-timeout 15 --max-time 120 "${archive}" | tar -xz --strip-components=1 -C .`,
    staging,
  );
  log("build-start", { sha });
  await runShell(installCommand, staging);
  fs.writeFileSync(path.join(staging, ".astra-ready"), sha);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.renameSync(staging, dir);
  log("build-pass", { sha });
  return dir;
}

async function waitHealthy(port, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "not checked";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}${healthPath}`, {
        headers: { "user-agent": "ASTRA-PUBLIC-SYNC-HEALTH/1.0" },
        signal: AbortSignal.timeout(5_000),
      });
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error(`Child healthcheck timeout: ${lastError}`);
}

async function startRevision(sha, dir) {
  const port = nextPort;
  nextPort = nextPort === 19081 ? 19082 : 19081;
  const child = spawn("bash", ["-lc", startCommand], {
    cwd: dir,
    env: { ...process.env, PORT: String(port), ASTRA_DEPLOY_REV: sha, BETGPT_DEPLOY_REV: sha },
    stdio: "inherit",
  });
  child.once("exit", (code, signal) => {
    if (active?.child === child) {
      log("active-child-exit", { sha, code, signal });
      active = null;
    } else {
      log("retired-child-exit", { sha, code, signal });
    }
  });

  try {
    await waitHealthy(port);
    return { sha, dir, port, child };
  } catch (error) {
    child.kill("SIGTERM");
    throw error;
  }
}

async function activate(sha) {
  const dir = await prepareRevision(sha);
  const candidate = await startRevision(sha, dir);
  const previous = active;
  active = candidate;
  log("activate", { sha, port: candidate.port, previous: previous?.sha ?? null });
  if (previous?.child && !previous.child.killed) {
    setTimeout(() => previous.child.kill("SIGTERM"), 5_000).unref();
  }

  try {
    for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (entry.name === sha || entry.name.endsWith(".staging")) continue;
      fs.rmSync(path.join(baseDir, entry.name), { recursive: true, force: true });
    }
  } catch (error) {
    log("cleanup-warning", { error: error instanceof Error ? error.message : String(error) });
  }
}

async function sync() {
  if (updateInFlight) return;
  updateInFlight = true;
  try {
    const sha = await resolveHead();
    if (active?.sha === sha) {
      log("current", { sha });
      return;
    }
    log("revision-change", { from: active?.sha ?? null, to: sha });
    await activate(sha);
  } catch (error) {
    log("sync-fail-closed", {
      activeSha: active?.sha ?? null,
      error: error instanceof Error ? error.stack || error.message : String(error),
    });
    if (!active) process.exitCode = 1;
  } finally {
    updateInFlight = false;
  }
}

function proxy(req, res) {
  const current = active;
  if (!current) {
    res.writeHead(503, { "content-type": "text/plain; charset=utf-8", "retry-after": "5" });
    res.end("ASTRA public sync is preparing the verified revision.");
    return;
  }

  const originalHost = req.headers.host;
  const headers = { ...req.headers };
  delete headers.connection;
  delete headers["proxy-connection"];
  delete headers.upgrade;
  headers.host = originalHost || "betgpt.live";
  headers["x-forwarded-host"] = originalHost || "betgpt.live";
  headers["x-astra-public-revision"] = current.sha;

  const upstream = http.request(
    {
      hostname: "127.0.0.1",
      port: current.port,
      path: req.url,
      method: req.method,
      headers,
    },
    (upstreamResponse) => {
      const responseHeaders = { ...upstreamResponse.headers };
      responseHeaders["x-astra-public-revision"] = current.sha;
      res.writeHead(upstreamResponse.statusCode || 502, responseHeaders);
      upstreamResponse.pipe(res);
    },
  );

  upstream.on("error", (error) => {
    log("proxy-error", { sha: current.sha, error: error.message, path: req.url });
    if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    res.end("Upstream temporarily unavailable.");
  });
  req.pipe(upstream);
}

fs.mkdirSync(baseDir, { recursive: true });
const server = http.createServer(proxy);
server.listen(publicPort, "0.0.0.0", () => log("router-listening", { port: publicPort, repo, branch, pollMs }));

await sync();
if (!active) {
  log("startup-fail", {});
  process.exit(1);
}

setInterval(sync, pollMs).unref();

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    log("shutdown", { signal });
    active?.child?.kill("SIGTERM");
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 10_000).unref();
  });
}
