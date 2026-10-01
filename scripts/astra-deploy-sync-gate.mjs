#!/usr/bin/env node
import { execFileSync } from "node:child_process";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function run(cmd, args) {
  return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function arg(name, fallback = "") {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? "") : fallback;
}

const service = arg("service", process.env.RAILWAY_SERVICE || "");
const environment = arg("environment", process.env.RAILWAY_ENVIRONMENT || "production");
const project = arg("project", process.env.RAILWAY_PROJECT || "");
const deploy = process.argv.includes("--deploy");

if (!service) {
  console.error("ASTRA_DEPLOY_SYNC_FAIL missing --service");
  process.exit(2);
}

let expected = process.env.EXPECTED_SOURCE_SHA || process.env.GITHUB_SHA || "";
if (!expected) {
  try { expected = run("git", ["rev-parse", "HEAD"]); } catch {}
}
if (!expected) {
  console.error("ASTRA_DEPLOY_SYNC_FAIL unable to resolve expected source SHA");
  process.exit(2);
}

const scope = [];
if (project) scope.push("--project", project);
scope.push("--environment", environment, "--service", service);

if (deploy) {
  run("railway", ["redeploy", "--service", service, "--environment", environment, "--from-source", "--yes"]);
}

const deadline = Date.now() + Number(process.env.ASTRA_DEPLOY_SYNC_TIMEOUT_MS || 12 * 60_000);
let last = null;

while (Date.now() < deadline) {
  const raw = run("railway", ["deployment", "list", ...scope, "--limit", "5", "--json"]);
  const parsed = JSON.parse(raw);
  const deployments = Array.isArray(parsed) ? parsed : (parsed.deployments || []);
  const current = deployments.find((d) => !["REMOVED", "REMOVING"].includes(String(d.status || "").toUpperCase())) || deployments[0];
  last = current || last;

  if (current) {
    const status = String(current.status || "").toUpperCase();
    const deployed = String(
      current?.meta?.commitHash ||
      current?.commitHash ||
      current?.source?.commitHash ||
      ""
    );

    const same = deployed && (
      deployed === expected ||
      deployed.startsWith(expected) ||
      expected.startsWith(deployed)
    );

    if (["FAILED", "CRASHED"].includes(status)) {
      console.error(JSON.stringify({
        gate: "ASTRA_DEPLOY_SYNC",
        status: "FAIL",
        expected_source_sha: expected,
        deployed_source_sha: deployed || null,
        deployment_status: status,
        deployment_id: current.id || null
      }));
      process.exit(1);
    }

    if (status === "SUCCESS") {
      if (!same) {
        console.error(JSON.stringify({
          gate: "ASTRA_DEPLOY_SYNC",
          status: "FAIL_SHA_MISMATCH",
          expected_source_sha: expected,
          deployed_source_sha: deployed || null,
          deployment_status: status,
          deployment_id: current.id || null
        }));
        process.exit(3);
      }

      console.log(JSON.stringify({
        gate: "ASTRA_DEPLOY_SYNC",
        status: "PASS",
        expected_source_sha: expected,
        deployed_source_sha: deployed,
        deployment_status: status,
        deployment_id: current.id || null
      }));
      process.exit(0);
    }
  }

  await sleep(10_000);
}

console.error(JSON.stringify({
  gate: "ASTRA_DEPLOY_SYNC",
  status: "UNVERIFIED_TIMEOUT",
  expected_source_sha: expected,
  last_seen: last
}));
process.exit(4);
