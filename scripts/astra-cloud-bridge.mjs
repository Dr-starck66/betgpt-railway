#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

const configPath = process.argv[2] || process.env.ASTRA_CLOUD_BRIDGE_CONFIG || "config/astra-cloud-bridge.json";
const evidenceDir = process.env.ASTRA_CLOUD_BRIDGE_EVIDENCE_DIR || "artifacts";
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getPath(value, dotted) {
  if (!dotted) return value;
  return String(dotted)
    .split(".")
    .filter(Boolean)
    .reduce((acc, key) => (acc == null ? undefined : acc[key]), value);
}

function normalize(text) {
  return String(text ?? "").replaceAll("’", "'").toLowerCase();
}

function assertText(value, rule = {}) {
  const text = String(value ?? "");
  const n = normalize(text);
  const failures = [];
  for (const fragment of rule.requireAll ?? []) {
    if (!n.includes(normalize(fragment))) failures.push(`missing: ${fragment}`);
  }
  if (rule.requireAny?.length && !rule.requireAny.some((fragment) => n.includes(normalize(fragment)))) {
    failures.push(`missing any of: ${rule.requireAny.join(" | ")}`);
  }
  for (const fragment of rule.forbid ?? []) {
    if (n.includes(normalize(fragment))) failures.push(`forbidden: ${fragment}`);
  }
  return failures;
}

async function requestWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, redirect: "follow" });
  } finally {
    clearTimeout(timer);
  }
}

async function runProbe(target, probe) {
  const retries = Number(probe.retries ?? config.defaults?.retries ?? 3);
  const delayMs = Number(probe.retryDelayMs ?? config.defaults?.retryDelayMs ?? 3000);
  const timeoutMs = Number(probe.timeoutMs ?? config.defaults?.timeoutMs ?? 30000);
  const expectedStatuses = probe.expect?.statuses ?? [200];
  let last = null;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const started = performance.now();
    const url = new URL(probe.path || "/", target.url).toString();
    let status = 0;
    let raw = "";
    let json = null;
    let error = null;
    const failures = [];

    try {
      const headers = {
        "user-agent": "ASTRA-CLOUD-BRIDGE/1.0",
        accept: "application/json,text/plain,text/html,*/*",
        ...(probe.headers ?? {}),
      };
      const init = { method: probe.method || "GET", headers };
      if (probe.body !== undefined) {
        init.body = JSON.stringify(probe.body);
        init.headers["content-type"] = init.headers["content-type"] || "application/json";
      }
      const response = await requestWithTimeout(url, init, timeoutMs);
      status = response.status;
      raw = await response.text();
      const hostHeaders = {
        server: response.headers.get("server"),
        via: response.headers.get("via"),
        xVercelId: response.headers.get("x-vercel-id"),
        xNetlifyRequestId: response.headers.get("x-nf-request-id"),
        xRailwayRequestId: response.headers.get("x-railway-request-id"),
        xServedBy: response.headers.get("x-served-by"),
        finalUrl: response.url,
      };
      console.log("ASTRA_HEADERS", target.id, probe.id, JSON.stringify(hostHeaders));

      if (!expectedStatuses.includes(status)) failures.push(`HTTP ${status}, expected ${expectedStatuses.join(",")}`);

      if (probe.expect?.jsonPath || probe.expect?.jsonText) {
        try {
          json = JSON.parse(raw);
        } catch (err) {
          failures.push(`invalid JSON: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      if (probe.expect?.text) failures.push(...assertText(raw, probe.expect.text));
      if (json && probe.expect?.jsonText) {
        const selected = getPath(json, probe.expect.jsonPath || "text");
        failures.push(...assertText(selected, probe.expect.jsonText));
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      failures.push(error);
    }

    last = {
      id: probe.id,
      method: probe.method || "GET",
      url,
      attempt,
      status,
      latencyMs: Math.round(performance.now() - started),
      pass: failures.length === 0,
      failures,
      responseExcerpt: raw.slice(0, 4000),
      error,
    };

    if (last.pass) return last;
    if (attempt < retries) await sleep(delayMs);
  }
  return last;
}

async function runTarget(target) {
  const probes = [];
  for (const probe of config.probes ?? []) probes.push(await runProbe(target, probe));
  return {
    id: target.id,
    url: target.url,
    provider: target.provider || "unknown",
    fallback: Boolean(target.fallback),
    priority: Number(target.priority ?? 100),
    pass: probes.every((probe) => probe?.pass),
    probes,
  };
}

const targets = [...(config.targets ?? [])].sort((a, b) => Number(a.priority ?? 100) - Number(b.priority ?? 100));
const results = [];
for (const target of targets) {
  console.log(`ASTRA_BRIDGE_PROBE target=${target.id} url=${target.url}`);
  const result = await runTarget(target);
  results.push(result);
  console.log(`ASTRA_BRIDGE_RESULT target=${target.id} status=${result.pass ? "PASS" : "FAIL"}`);
}

const healthyPrimary = results.find((r) => r.pass && !r.fallback);
const healthyFallback = results.find((r) => r.pass && r.fallback);
const selected = healthyPrimary ?? healthyFallback ?? null;

const evidence = {
  schema: "astra-cloud-bridge/evidence-v1",
  generatedAt: new Date().toISOString(),
  config: config.name || path.basename(configPath),
  status: selected ? (selected.fallback ? "PARTIAL" : "PASS") : "FAIL",
  selectedTarget: selected ? { id: selected.id, url: selected.url, provider: selected.provider, fallback: selected.fallback } : null,
  targets: results,
};

fs.mkdirSync(evidenceDir, { recursive: true });
fs.writeFileSync(path.join(evidenceDir, "astra-cloud-bridge-evidence.json"), JSON.stringify(evidence, null, 2));

const md = [
  "# ASTRA CLOUD BRIDGE — Evidence",
  "",
  `- Status: **${evidence.status}**`,
  `- Generated: ${evidence.generatedAt}`,
  `- Selected target: ${selected ? `${selected.id} (${selected.provider})${selected.fallback ? " — FALLBACK" : ""}` : "NONE"}`,
  "",
  "## Targets",
  ...results.flatMap((target) => [
    `### ${target.pass ? "✅" : "❌"} ${target.id} — ${target.provider}${target.fallback ? " (fallback)" : ""}`,
    `URL: ${target.url}`,
    ...target.probes.map((probe) =>
      `- ${probe.pass ? "PASS" : "FAIL"} ${probe.method} ${new URL(probe.url).pathname} · HTTP ${probe.status || "ERR"} · ${probe.latencyMs} ms${probe.failures.length ? ` · ${probe.failures.join("; ")}` : ""}`
    ),
    "",
  ]),
].join("\n");

fs.writeFileSync(path.join(evidenceDir, "astra-cloud-bridge-summary.md"), md);
console.log(md);

if (!selected) {
  console.error("ASTRA_ROUTE_SELECTED none");
  process.exit(1);
}
console.log(`ASTRA_ROUTE_SELECTED target=${selected.id} provider=${selected.provider} fallback=${selected.fallback}`);
