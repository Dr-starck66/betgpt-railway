#!/usr/bin/env node
import fs from "node:fs";

const cfgPath = process.env.ASTRA_RESUME_GUARD_CONFIG || "config/astra-resume-guard.json";
function fail(msg){ console.error("ASTRA_RESUME_GUARD_FAIL:", msg); process.exit(1); }

if (!fs.existsSync(cfgPath)) fail(`missing ${cfgPath}`);
const cfg=JSON.parse(fs.readFileSync(cfgPath,"utf8"));

if (cfg.mode !== "RESUME_FROM_LAST_PROVEN_CHECKPOINT") fail("invalid mode");
if (cfg.failurePolicy !== "FAIL_CLOSED_BUT_RESUMABLE") fail("invalid failurePolicy");

const r=cfg.requirements||{};
for (const key of [
  "idempotentSteps",
  "checkpointAfterCriticalStep",
  "persistProofLedger",
  "retryTransientFailures",
  "boundedExponentialBackoff",
  "resumeInsteadOfRestart",
  "neverDeclarePassWithoutFinalProof",
  "neverWaitSilentlyForUserReconnect"
]) {
  if (r[key] !== true) fail(`requirement ${key} must be true`);
}

const retry=cfg.retryPolicy||{};
if (!Number.isInteger(retry.maxAttempts) || retry.maxAttempts < 2 || retry.maxAttempts > 10) {
  fail("maxAttempts must be between 2 and 10");
}
if (!(retry.baseDelaySeconds > 0) || !(retry.maxDelaySeconds >= retry.baseDelaySeconds)) {
  fail("invalid backoff bounds");
}

const cp=cfg.checkpointPolicy||{};
if (!cp.directory || !cp.ledger || cp.atomicWrite !== true) fail("invalid checkpoint policy");

console.log("ASTRA RESUME GUARD PASS: resumable, checkpointed, idempotent, retry-bounded execution enforced.");
