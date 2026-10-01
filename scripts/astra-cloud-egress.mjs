#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import dns from "node:dns/promises";
import { performance } from "node:perf_hooks";

const argv = process.argv.slice(2);
const validateOnly = argv.includes("--validate-config");
const configArg = argv.find((arg) => !arg.startsWith("--"));
const configPath =
  configArg ||
  process.env.ASTRA_CLOUD_EGRESS_CONFIG ||
  "config/astra-cloud-egress.json";
const evidenceDir =
  process.env.ASTRA_CLOUD_EGRESS_EVIDENCE_DIR ||
  "artifacts/cloud-egress";

function loadConfig() {
  const raw = fs.readFileSync(configPath, "utf8");
  const config = JSON.parse(raw);
  const errors = [];
  if (!config.name) errors.push("name is required");
  if (!Array.isArray(config.targets) || !config.targets.length) errors.push("at least one target is required");
  if (!Array.isArray(config.probes) || !config.probes.length) errors.push("at least one probe is required");
  for (const target of config.targets ?? []) {
    if (!target.id) errors.push("target.id is required");
    try {
      const url = new URL(target.url);
      if (!["https:", "http:"].includes(url.protocol)) errors.push(`unsupported protocol for ${target.id}`);
    } catch {
      errors.push(`invalid target URL for ${target.id}`);
    }
  }
  for (const probe of config.probes ?? []) {
    if (!probe.id) errors.push("probe.id is required");
    if (!String(probe.path ?? "/").startsWith("/")) errors.push(`probe.path must start with / for ${probe.id}`);
  }
  if (errors.length) {
    console.error("ASTRA_CLOUD_EGRESS_CONFIG_FAIL");
    for (const error of errors) console.error("- " + error);
    process.exit(2);
  }
  return config;
}

const config = loadConfig();
if (validateOnly) {
  console.log("ASTRA_CLOUD_EGRESS_CONFIG_PASS");
  process.exit(0);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalize(value) {
  return String(value ?? "").replaceAll("’", "'").toLowerCase();
}

function textFailures(value, rule = {}) {
  const normalized = normalize(value);
  const failures = [];
  for (const fragment of rule.requireAll ?? []) {
    if (!normalized.includes(normalize(fragment))) failures.push(`missing: ${fragment}`);
  }
  if (rule.requireAny?.length && !rule.requireAny.some((fragment) => normalized.includes(normalize(fragment)))) {
    failures.push(`missing any: ${rule.requireAny.join(" | ")}`);
  }
  for (const fragment of rule.forbid ?? []) {
    if (normalized.includes(normalize(fragment))) failures.push(`forbidden: ${fragment}`);
  }
  return failures;
}

function getPath(value, dotted) {
  if (!dotted) return value;
  return String(dotted)
    .split(".")
    .filter(Boolean)
    .reduce((acc, key) => (acc == null ? undefined : acc[key]), value);
}

async function cloudDns(hostname) {
  const started = performance.now();
  const result = { hostname, a: [], aaaa: [], cname: [], ns: [], pass: false, latencyMs: 0, errors: [] };
  try {
    result.a = await dns.resolve4(hostname);
  } catch (error) {
    result.errors.push(`A: ${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    result.aaaa = await dns.resolve6(hostname);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/ENODATA|ENOTFOUND/i.test(message)) result.errors.push(`AAAA: ${message}`);
  }
  try {
    result.cname = await dns.resolveCname(hostname);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/ENODATA|ENOTFOUND|ENOTIMP/i.test(message)) result.errors.push(`CNAME: ${message}`);
  }
  try {
    result.ns = await dns.resolveNs(hostname);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/ENODATA|ENOTFOUND|ENOTIMP/i.test(message)) result.errors.push(`NS: ${message}`);
  }
  result.latencyMs = Math.round(performance.now() - started);
  result.pass = result.a.length > 0 || result.aaaa.length > 0;
  return result;
}

async function fetchWithTimeout(url, init, timeoutMs) {
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
  const retryDelayMs = Number(probe.retryDelayMs ?? config.defaults?.retryDelayMs ?? 2500);
  const timeoutMs = Number(probe.timeoutMs ?? config.defaults?.timeoutMs ?? 25000);
  const expectedStatuses = probe.expect?.statuses ?? [200];
  let last;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const url = new URL(probe.path || "/", target.url).toString();
    const started = performance.now();
    const failures = [];
    let status = 0;
    let body = "";
    let responseUrl = url;
    let headers = {};
    let error = null;

    try {
      const init = {
        method: probe.method || "GET",
        headers: {
          "user-agent": "ASTRA-CLOUD-EGRESS/2.0",
          accept: "application/json,text/html,text/plain,*/*",
          ...(probe.headers ?? {}),
        },
      };
      if (probe.body !== undefined) {
        init.body = typeof probe.body === "string" ? probe.body : JSON.stringify(probe.body);
        init.headers["content-type"] ||= "application/json";
      }
      const response = await fetchWithTimeout(url, init, timeoutMs);
      status = response.status;
      responseUrl = response.url;
      body = await response.text();
      headers = {
        server: response.headers.get("server"),
        via: response.headers.get("via"),
        railwayRequestId: response.headers.get("x-railway-request-id"),
        vercelId: response.headers.get("x-vercel-id"),
        netlifyRequestId: response.headers.get("x-nf-request-id"),
        cache: response.headers.get("x-cache") || response.headers.get("cf-cache-status"),
      };

      if (!expectedStatuses.includes(status)) {
        failures.push(`HTTP ${status}; expected ${expectedStatuses.join(",")}`);
      }
      if (probe.expect?.text) failures.push(...textFailures(body, probe.expect.text));
      if (probe.expect?.jsonText || probe.expect?.jsonPath) {
        try {
          const parsed = JSON.parse(body);
          const selected = getPath(parsed, probe.expect.jsonPath || "text");
          failures.push(...textFailures(selected, probe.expect.jsonText ?? {}));
        } catch (parseError) {
          failures.push(`invalid JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
        }
      }
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
      failures.push(error);
    }

    last = {
      id: probe.id,
      method: probe.method || "GET",
      url,
      responseUrl,
      attempt,
      status,
      pass: failures.length === 0,
      latencyMs: Math.round(performance.now() - started),
      failures,
      headers,
      error,
      excerpt: body.slice(0, Number(config.defaults?.excerptChars ?? 1200)),
    };

    if (last.pass) break;
    if (attempt < retries) await sleep(retryDelayMs);
  }

  return last;
}

async function runTarget(target) {
  const parsed = new URL(target.url);
  const dnsEvidence = await cloudDns(parsed.hostname);
  const probes = [];
  for (const probe of config.probes) probes.push(await runProbe(target, probe));
  return {
    id: target.id,
    provider: target.provider || "unknown",
    url: target.url,
    priority: Number(target.priority ?? 100),
    fallback: Boolean(target.fallback),
    dns: dnsEvidence,
    pass: dnsEvidence.pass && probes.every((probe) => probe.pass),
    probes,
  };
}

const targets = [...config.targets].sort((a, b) => Number(a.priority ?? 100) - Number(b.priority ?? 100));
const results = [];
for (const target of targets) {
  console.log(`ASTRA_CLOUD_EGRESS target=${target.id} url=${target.url}`);
  results.push(await runTarget(target));
}

const primary = results.find((target) => target.pass && !target.fallback);
const fallback = results.find((target) => target.pass && target.fallback);
const selected = primary ?? fallback ?? null;
const status = selected ? (selected.fallback ? "PARTIAL" : "PASS") : "FAIL";

const evidence = {
  schema: "astra-cloud-egress/evidence-v2",
  generatedAt: new Date().toISOString(),
  configName: config.name,
  verificationRevision: config.verificationRevision ?? null,
  status,
  execution: "remote-cloud-runner",
  selectedTarget: selected
    ? { id: selected.id, provider: selected.provider, url: selected.url, fallback: selected.fallback }
    : null,
  targets: results,
};

fs.mkdirSync(evidenceDir, { recursive: true });
fs.writeFileSync(path.join(evidenceDir, "evidence.json"), JSON.stringify(evidence, null, 2));

const summary = [
  "# ASTRA CLOUD EGRESS Ω — Evidence",
  "",
  `- Status: **${status}**`,
  `- Execution: **remote-cloud-runner**`,
  `- Revision: ${evidence.verificationRevision ?? "n/a"}`,
  `- Selected target: ${selected ? `${selected.id} · ${selected.provider}${selected.fallback ? " · FALLBACK" : ""}` : "NONE"}`,
  "",
  ...results.flatMap((target) => [
    `## ${target.pass ? "✅" : "❌"} ${target.id} — ${target.provider}`,
    `- DNS cloud: ${target.dns.pass ? "PASS" : "FAIL"} · A=${target.dns.a.join(",") || "—"} · AAAA=${target.dns.aaaa.join(",") || "—"} · CNAME=${target.dns.cname.join(",") || "—"} · NS=${target.dns.ns.join(",") || "—"} · ${target.dns.latencyMs}ms`,
    ...target.probes.map(
      (probe) =>
        `- ${probe.pass ? "PASS" : "FAIL"} · ${probe.method} ${new URL(probe.url).pathname} · HTTP ${probe.status || "ERR"} · ${probe.latencyMs}ms · server=${probe.headers.server || "—"} · via=${probe.headers.via || "—"} · railway=${probe.headers.railwayRequestId || "—"} · vercel=${probe.headers.vercelId || "—"} · netlify=${probe.headers.netlifyRequestId || "—"}${probe.failures.length ? ` · ${probe.failures.join("; ")}` : ""}`,
    ),
    "",
  ]),
].join("\n");

fs.writeFileSync(path.join(evidenceDir, "summary.md"), summary);
console.log(summary);

if (!selected) process.exit(1);
