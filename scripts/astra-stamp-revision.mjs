#!/usr/bin/env node
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
