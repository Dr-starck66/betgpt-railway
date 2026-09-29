import { spawn } from "node:child_process";

const cwd = process.cwd();
const intervalMs = Math.max(60_000, Number(process.env.BETGPT_UPDATE_POLL_MS || 60_000));
const enabled = process.env.BETGPT_GIT_AUTOUPDATE !== "0";

function run(cmd, args) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", () => undefined);
    child.on("close", (code) => resolve(code === 0 ? out.trim() : ""));
    child.on("error", () => resolve(""));
  });
}

const current = (await run("git", ["rev-parse", "HEAD"])).trim();
console.log("[supervisor] commit", current || "unknown");

const preview = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["vite", "preview", "--host", "0.0.0.0", "--port", "8080"],
  { cwd, stdio: "inherit", env: process.env },
);

async function runEditorial(reason) {
  const token = (process.env.BETGPT_EDITORIAL_CRON_TOKEN || "").trim();
  if (!token) {
    console.log("[supervisor-editorial] skipped: token missing");
    return;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90_000);
    const res = await fetch("http://127.0.0.1:8080/api/editorial-run", {
      headers: {
        authorization: `Bearer ${token}`,
        "user-agent": "BetGPT-Local-Scheduler/1.0",
        "cache-control": "no-cache",
      },
      signal: controller.signal,
    });
    const body = await res.text();
    clearTimeout(timer);
    console.log("[supervisor-editorial]", reason, res.status, body.slice(0, 4000));
  } catch (error) {
    console.error("[supervisor-editorial] FAILED", reason, error instanceof Error ? error.stack ?? error.message : String(error));
  }
}

async function runPublicGate(reason) {
  const base = "https://betgpt.live";
  const checks = [
    { name: "home", path: "/", need: ["Scores live, pronostics IA et données football.", "Bilan ROI", "Chat IA"] },
    { name: "match", path: "/match/guinee-bissau-nigeria-2026-09-29", need: ["Nigeria"], forbid: ["Ce match n’est pas dans le bureau actuel", "Ce match n'est pas dans le bureau actuel"], crest: true, prono: true },
    { name: "ledger", path: "/ledger", need: ["Bilan BetGPT", "ROI"] },
    { name: "chat", path: "/chat", need: ["Chat BetGPT"] },
    { name: "actualites", path: "/actualites", need: ["Actualités football"] },
    { name: "article", path: "/actualites/guinea-bissau-nigeria-brief-2026-09-29", need: ["Guinea-Bissau", "Nigeria"] },
    { name: "robots", path: "/robots.txt", need: ["Sitemap:", "https://betgpt.live/sitemap.xml"] },
    { name: "sitemap", path: "/sitemap.xml", need: ["https://betgpt.live/"] },
    { name: "news-sitemap", path: "/news-sitemap.xml", need: ["guinea-bissau-nigeria-brief-2026-09-29"] },
  ];
  const results = [];
  let ok = true;
  for (const check of checks) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30_000);
      const res = await fetch(base + check.path, {
        redirect: "follow",
        headers: { "user-agent": "ASTRA-BetGPT-PublicGate/2.0", "cache-control": "no-cache" },
        signal: controller.signal,
      });
      const body = await res.text();
      clearTimeout(timer);
      const missing = (check.need || []).filter((m) => !body.includes(m));
      const forbidden = (check.forbid || []).filter((m) => body.includes(m));
      const hasCrest = !check.crest || /\/crests\/\d+\.png|teamlogos\/soccer\/500\/\d+\.png/.test(body);
      const hasProno = !check.prono || /Pronostic|probabilit|Pari conseillé|modèle/i.test(body);
      const rowOk = res.status === 200 && missing.length === 0 && forbidden.length === 0 && hasCrest && hasProno;
      results.push({ name: check.name, status: res.status, bytes: Buffer.byteLength(body), missing, forbidden, hasCrest, hasProno, ok: rowOk });
      ok = ok && rowOk;
    } catch (error) {
      ok = false;
      results.push({ name: check.name, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
  console.log("[public-gate]", reason, JSON.stringify({ ok, results }));
}

const editorialFirst = setTimeout(async () => {
  await runEditorial("startup");
  await runPublicGate("startup");
}, 20_000);
editorialFirst.unref?.();
const editorialTimer = setInterval(() => void runEditorial("interval"), 5 * 60 * 1000);
editorialTimer.unref?.();
const publicGateTimer = setInterval(() => void runPublicGate("interval"), 15 * 60 * 1000);
publicGateTimer.unref?.();

let stopping = false;
function stop(signal = "SIGTERM") {
  if (stopping) return;
  stopping = true;
  try { preview.kill(signal); } catch {}
}
process.on("SIGTERM", () => stop("SIGTERM"));
process.on("SIGINT", () => stop("SIGINT"));

if (enabled && current) {
  const timer = setInterval(async () => {
    if (stopping) return;
    const line = await run("git", ["ls-remote", "origin", "refs/heads/main"]);
    const remote = line.split(/\s+/)[0] || "";
    if (!remote || remote === current) return;
    console.log("[supervisor] new main commit detected", remote);
    stop("SIGTERM");
    setTimeout(() => process.exit(75), 3000).unref();
  }, intervalMs);
  timer.unref();
}

preview.on("exit", (code, signal) => {
  if (stopping) {
    process.exit(code && code !== 0 ? code : 75);
    return;
  }
  console.error("[supervisor] preview exited", { code, signal });
  process.exit(code ?? 1);
});
