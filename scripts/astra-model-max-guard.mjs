#!/usr/bin/env node
import fs from "node:fs";

const modulePath = "src/lib/ai/astra-model-max.ts";
const configPath = "config/astra-model-max.json";
const testPath = "src/lib/ai/astra-model-max.test.ts";

for (const path of [modulePath, configPath, testPath]) {
  if (!fs.existsSync(path)) {
    console.error(`ASTRA_MODEL_MAX_GUARD_FAIL: missing ${path}`);
    process.exit(1);
  }
}

const source = fs.readFileSync(modulePath, "utf8");
const cfg = JSON.parse(fs.readFileSync(configPath, "utf8"));

for (const marker of [
  "authorizedAvailableModels",
  "assertRequestedModelAuthorized",
  "buildAstraModelMaxPlan",
  'status: "FAIL"',
  'status: needsIndependentCritic',
]) {
  if (!source.includes(marker)) {
    console.error(`ASTRA_MODEL_MAX_GUARD_FAIL: missing marker ${marker}`);
    process.exit(1);
  }
}

if (cfg.requireVerifiedAuthorization !== true || cfg.allowUndiscoveredModels !== false) {
  console.error("ASTRA_MODEL_MAX_GUARD_FAIL: authorization must fail closed");
  process.exit(1);
}

console.log("ASTRA MODEL MAX GUARD PASS: quality-first routing is fail-closed on model authorization.");
