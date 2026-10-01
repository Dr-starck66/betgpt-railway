#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const branchIndex = args.indexOf("--branch");
const messageIndex = args.indexOf("--message");
const branch = branchIndex >= 0 ? args[branchIndex + 1] : process.env.GITHUB_REF_NAME || "main";
const message = messageIndex >= 0 ? args[messageIndex + 1] : "chore: persist generated artifacts";
const files = args.filter((arg, i) => {
  if (arg === "--branch" || arg === "--message") return false;
  if (i === branchIndex + 1 || i === messageIndex + 1) return false;
  return !arg.startsWith("--");
});
const attempts = Math.max(1, Number(process.env.ASTRA_SAFE_PUSH_ATTEMPTS || 6));

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    encoding: "utf8",
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    env: process.env,
  });
  return result;
}

if (!files.length) {
  console.error("ASTRA_SAFE_PUSH_FAIL: no files supplied");
  process.exit(2);
}

run("git", ["config", "user.name", process.env.ASTRA_GIT_USER_NAME || "github-actions[bot]"]);
run("git", ["config", "user.email", process.env.ASTRA_GIT_USER_EMAIL || "41898282+github-actions[bot]@users.noreply.github.com"]);
run("git", ["add", "--", ...files]);

const staged = run("git", ["diff", "--cached", "--quiet"]);
if (staged.status === 0) {
  console.log("ASTRA_SAFE_PUSH_NOOP: no generated changes");
  process.exit(0);
}

if (run("git", ["commit", "-m", message]).status !== 0) {
  console.error("ASTRA_SAFE_PUSH_FAIL: commit failed");
  process.exit(1);
}

for (let attempt = 1; attempt <= attempts; attempt += 1) {
  console.log(`ASTRA_SAFE_PUSH attempt=${attempt}/${attempts} branch=${branch}`);
  if (run("git", ["fetch", "origin", branch]).status !== 0) {
    console.error("ASTRA_SAFE_PUSH_FAIL: fetch failed");
    process.exit(1);
  }

  const rebase = run("git", ["rebase", `origin/${branch}`]);
  if (rebase.status !== 0) {
    run("git", ["rebase", "--abort"]);
    console.error("ASTRA_SAFE_PUSH_FAIL: generated artifacts conflict with newer canonical changes");
    process.exit(1);
  }

  const push = run("git", ["push", "origin", `HEAD:${branch}`]);
  if (push.status === 0) {
    console.log("ASTRA_SAFE_PUSH_PASS");
    process.exit(0);
  }
}

console.error("ASTRA_SAFE_PUSH_FAIL: push race did not converge");
process.exit(1);
