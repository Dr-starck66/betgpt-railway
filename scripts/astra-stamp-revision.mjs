#!/usr/bin/env node
// ASTRA isolated audit mode: deny all active operations BEFORE entrypoint execution.
if (process.env.ASTRA_RISK_MODE === "audit") {
  process.stderr.write("ASTRA_RISK_EFFECTS_BLOCKED "+JSON.stringify({entrypoint:"scripts/astra-stamp-revision.mjs",status:"BLOCKED",operationStatus:"UNVERIFIED",exitCode:78})+"\n");
  process.exit(78);
}
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const out = process.argv[3] || "public/astra-revision.json";

function gitSha() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

const sourceSha = String(process.argv[2] || gitSha() || "unknown").trim();
const payload = {
  schema: "astra-public-route-revision/v1",
  sourceSha,
  generatedAt: new Date().toISOString(),
};

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(payload, null, 2) + "\n");
console.log("ASTRA_REVISION_STAMP", JSON.stringify(payload));
