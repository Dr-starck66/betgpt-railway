#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const argv = process.argv.slice(2);
const mode = argv[0] || "validate";
const profile = argv[1] || "";
const configPath = process.env.ASTRA_RELEASE_GATE_CONFIG || "config/astra-release-gate.json";
const evidenceDir = process.env.ASTRA_RELEASE_GATE_EVIDENCE_DIR || "artifacts/astra-release-gate";

function loadConfig() {
  const raw = fs.readFileSync(configPath, "utf8");
  const cfg = JSON.parse(raw);
  const errors = [];
  if (!cfg.siteId) errors.push("siteId is required");
  if (!cfg.canonicalOrigin) errors.push("canonicalOrigin is required");
  if (!Array.isArray(cfg.publicOrigins) || !cfg.publicOrigins.length) errors.push("publicOrigins[] is required");
  if (!cfg.healthPath) errors.push("healthPath is required");
  if (!cfg.revisionPath) errors.push("revisionPath is required");
  if (errors.length) {
    console.error("ASTRA_RELEASE_GATE_CONFIG_FAIL");
    for (const e of errors) console.error("- " + e);
    process.exit(2);
  }
  return cfg;
}

const cfg = loadConfig();
fs.mkdirSync(evidenceDir, { recursive: true });

function writeEvidence(name, payload) {
  fs.writeFileSync(path.join(evidenceDir, name), JSON.stringify(payload, null, 2) + "\n");
}

function runCommand(command) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn("bash", ["-lc", command], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });
    child.once("exit", (code, signal) => {
      resolve({
        command,
        pass: code === 0,
        code,
        signal,
        durationMs: Date.now() - started,
      });
    });
    child.once("error", (error) => {
      resolve({
        command,
        pass: false,
        code: null,
        signal: null,
        durationMs: Date.now() - started,
        error: error.message,
      });
    });
  });
}

async function runCommands(label, commands = []) {
  const results = [];
  let blockedContent = false;
  for (const command of commands) {
    console.log(`ASTRA_RELEASE_GATE ${label} :: ${command}`);
    const result = await runCommand(command);
    results.push(result);
    if (!result.pass) {
      blockedContent = label === "pipeline-editorial" && result.code === 78;
      break;
    }
  }
  const pass =
    blockedContent || (results.length === commands.length && results.every((r) => r.pass));
  const evidence = {
    schema: "astra-single-source-release-gate/commands-v1",
    siteId: cfg.siteId,
    label,
    generatedAt: new Date().toISOString(),
    status: blockedContent ? "BLOCKED_CONTENT" : pass ? "PASS" : "FAIL",
    pass,
    blockedContent,
    results,
  };
  writeEvidence(`${label.replace(/[^a-z0-9_-]+/gi, "-").toLowerCase()}.json`, evidence);
  if (blockedContent) {
    if (process.env.GITHUB_OUTPUT) {
      fs.appendFileSync(process.env.GITHUB_OUTPUT, "blocked=true\n");
    }
    console.log(`ASTRA_RELEASE_GATE_BLOCKED_CONTENT ${label}`);
    return;
  }
  if (!pass) {
    console.error(`ASTRA_RELEASE_GATE_FAIL ${label}`);
    process.exit(1);
  }
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, "blocked=false\n");
  }
  console.log(`ASTRA_RELEASE_GATE_PASS ${label}`);
}

async function fetchEvidence(base, targetName) {
  const origin = new URL(base).origin;
  const healthUrl = new URL(cfg.healthPath, origin).toString();
  const revisionUrl = new URL(cfg.revisionPath, origin).toString();
  const timeoutMs = Number(cfg.timeoutMs || 20000);

  async function get(url) {
    const response = await fetch(url, {
      redirect: "follow",
      headers: {
        "user-agent": "ASTRA-SINGLE-SOURCE-RELEASE-GATE/1.0",
        accept: "application/json,text/plain,*/*",
        "cache-control": "no-cache",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await response.text();
    return { response, text };
  }

  const health = await get(healthUrl);
  const revision = await get(revisionUrl);
  let parsed = null;
  try {
    parsed = JSON.parse(revision.text);
  } catch {}

  return {
    targetName,
    origin,
    health: {
      url: healthUrl,
      status: health.response.status,
      pass: health.response.ok,
      proxyHeader: health.response.headers.get("x-astra-public-proxy"),
      revisionHeader: health.response.headers.get("x-astra-revision"),
    },
    revision: {
      url: revisionUrl,
      status: revision.response.status,
      pass: revision.response.ok && Boolean(parsed?.sourceSha),
      sourceSha: parsed?.sourceSha || null,
      deploymentKey: parsed?.deploymentKey || null,
      proxyHeader: revision.response.headers.get("x-astra-public-proxy"),
      revisionHeader: revision.response.headers.get("x-astra-revision"),
    },
  };
}

async function postflight() {
  const canonical = await fetchEvidence(cfg.canonicalOrigin, "canonical");
  const publics = [];
  for (const item of cfg.publicOrigins) {
    const descriptor = typeof item === "string" ? { url: item } : item;
    const evidence = await fetchEvidence(descriptor.url, descriptor.id || descriptor.url);
    evidence.expectedProxyHeader = descriptor.expectedProxyHeader || null;
    evidence.requireDirect = Boolean(descriptor.requireDirect);
    publics.push(evidence);
  }

  const failures = [];
  if (!canonical.health.pass) failures.push("canonical health failed");
  if (!canonical.revision.pass) failures.push("canonical revision evidence missing");

  for (const pub of publics) {
    if (!pub.health.pass) failures.push(`${pub.targetName}: health failed`);
    if (!pub.revision.pass) failures.push(`${pub.targetName}: revision evidence missing`);
    if (canonical.revision.sourceSha && pub.revision.sourceSha !== canonical.revision.sourceSha) {
      failures.push(
        `${pub.targetName}: revision mismatch public=${pub.revision.sourceSha} canonical=${canonical.revision.sourceSha}`,
      );
    }
    if (pub.expectedProxyHeader) {
      const header = pub.health.proxyHeader || pub.revision.proxyHeader;
      if (header !== pub.expectedProxyHeader) {
        failures.push(`${pub.targetName}: expected proxy header ${pub.expectedProxyHeader}, got ${header || "none"}`);
      }
    }
    if (pub.requireDirect && (pub.health.proxyHeader || pub.revision.proxyHeader)) {
      failures.push(`${pub.targetName}: direct binding required but proxy shim detected`);
    }
  }

  const expectedRevision =
    process.env.ASTRA_EXPECTED_REVISION ||
    (cfg.requireGitHubShaParity ? process.env.GITHUB_SHA : "") ||
    cfg.expectedRevision ||
    "";

  if (expectedRevision && canonical.revision.sourceSha !== expectedRevision) {
    failures.push(
      `canonical revision ${canonical.revision.sourceSha || "missing"} != expected ${expectedRevision}`,
    );
  }

  const status = failures.length ? "FAIL" : "PASS";
  const evidence = {
    schema: "astra-single-source-release-gate/postflight-v1",
    siteId: cfg.siteId,
    generatedAt: new Date().toISOString(),
    status,
    expectedRevision: expectedRevision || null,
    canonical,
    publics,
    failures,
  };
  writeEvidence("postflight.json", evidence);
  console.log(JSON.stringify(evidence, null, 2));
  if (status !== "PASS") process.exit(1);
  console.log("ASTRA_SINGLE_SOURCE_RELEASE_GATE_PASS");
}

if (mode === "validate") {
  writeEvidence("config.json", {
    schema: "astra-single-source-release-gate/config-validation-v1",
    siteId: cfg.siteId,
    generatedAt: new Date().toISOString(),
    pass: true,
  });
  console.log("ASTRA_RELEASE_GATE_CONFIG_PASS");
} else if (mode === "preflight") {
  await runCommands("preflight", cfg.preflightCommands || []);
} else if (mode === "pipeline") {
  const commands = cfg.pipelines?.[profile]?.commands;
  if (!Array.isArray(commands) || !commands.length) {
    console.error(`Unknown or empty pipeline profile: ${profile}`);
    process.exit(2);
  }
  await runCommands(`pipeline-${profile}`, commands);
} else if (mode === "postflight") {
  await postflight();
} else {
  console.error("Usage: astra-release-gate.mjs validate|preflight|pipeline <name>|postflight");
  process.exit(2);
}
