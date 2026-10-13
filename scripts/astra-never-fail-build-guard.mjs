#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const configPath = process.env.ASTRA_NEVER_FAIL_CONFIG || "config/astra-never-fail-build-guard.json";
const cfg = JSON.parse(readFileSync(path.join(root, configPath), "utf8"));
// Validate configuration only: do not launch build checks or write reports.
if (process.argv.includes("--astra-dry-run")) {
  const mandatory=cfg.requiredChecks;
  const extra=cfg.extendedChecks??[];
  const entries=[...(Array.isArray(mandatory)?mandatory:[]),...(Array.isArray(extra)?extra:[])];
  const ids=entries.map(x=>x?.id);
  const valid=Array.isArray(mandatory)&&mandatory.length>0&&Array.isArray(extra)&&
    entries.every(x=>typeof x?.id==="string"&&x.id.trim()&&typeof x.command==="string"&&x.command.trim())&&
    new Set(ids).size===ids.length;
  if(!valid){
    console.error("ASTRA_NEVER_FAIL_DRY_RUN_FAIL invalid configured checks");
    process.exit(2);
  }
  console.log("ASTRA_NEVER_FAIL_DRY_RUN",JSON.stringify({
    status:"INSPECTED_ONLY",executionStatus:"UNVERIFIED",
    required:mandatory.length,extended:extra.length,commandsExecuted:0,filesWritten:0,networkCalls:0
  }));
  process.exit(0);
}

const extended = process.env.ASTRA_NEVER_FAIL_EXTENDED === "1" || process.argv.includes("--extended");
const checks = [
  ...(Array.isArray(cfg.requiredChecks) ? cfg.requiredChecks : []),
  ...(extended && Array.isArray(cfg.extendedChecks) ? cfg.extendedChecks : []),
];

if (!checks.length) {
  throw new Error("ASTRA_NEVER_FAIL_CONFIG_ERROR: no checks configured");
}

const report = {
  schema: "astra-never-fail-build-guard/v1",
  generatedAt: new Date().toISOString(),
  mode: extended ? "extended" : "required",
  commit: process.env.GITHUB_SHA || process.env.RAILWAY_GIT_COMMIT_SHA || null,
  status: "RUNNING",
  checks: [],
};

function persist() {
  const target = path.join(root, cfg.reportPath || "artifacts/release/never-fail-build.json");
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, JSON.stringify(report, null, 2) + "\n", "utf8");
}

for (const check of checks) {
  const id = String(check.id || "").trim();
  const command = String(check.command || "").trim();
  if (!id || !command) {
    report.status = "BLOCKED";
    report.reason = "invalid-check-config";
    persist();
    console.error("ASTRA_NEVER_FAIL_PROMOTION_BLOCKED invalid-check-config");
    process.exit(78);
  }

  const started = Date.now();
  console.log(`ASTRA_NEVER_FAIL_CHECK_START ${id}: ${command}`);
  const run = spawnSync(command, {
    cwd: root,
    shell: true,
    stdio: "inherit",
    env: { ...process.env, ASTRA_NEVER_FAIL_ACTIVE: "1" },
  });
  const durationMs = Date.now() - started;
  const exitCode = typeof run.status === "number" ? run.status : 1;
  report.checks.push({ id, command, exitCode, durationMs });

  if (exitCode !== 0) {
    report.status = "BLOCKED";
    report.blockedBy = id;
    report.completedAt = new Date().toISOString();
    persist();
    console.error(`ASTRA_NEVER_FAIL_PROMOTION_BLOCKED check=${id} exit=${exitCode}`);
    process.exit(78);
  }

  console.log(`ASTRA_NEVER_FAIL_CHECK_PASS ${id} durationMs=${durationMs}`);
}

report.status = "GREEN";
report.completedAt = new Date().toISOString();
persist();
console.log(`ASTRA_NEVER_FAIL_CANDIDATE_GREEN checks=${report.checks.length} mode=${report.mode}`);
