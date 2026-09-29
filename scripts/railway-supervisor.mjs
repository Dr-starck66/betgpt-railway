import { spawn } from "node:child_process";

const cwd = process.cwd();
const intervalMs = Math.max(60_000, Number(process.env.BETGPT_UPDATE_POLL_MS || 300_000));
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
