#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const configPath = process.argv[2] || "config/astra-public-route-gate.json";
const expectedRevision = String(process.argv[3] || "").trim();
if (!expectedRevision) throw new Error("Expected revision required as argv[3].");

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const evidenceDir = config.evidenceDir || "artifacts/astra-public-route-gate";
fs.mkdirSync(evidenceDir, { recursive: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(url, init = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      redirect: "follow",
      cache: "no-store",
      headers: {
        accept: "application/json,text/plain,*/*",
        "cache-control": "no-cache",
        pragma: "no-cache",
        "user-agent": "ASTRA-PUBLIC-ROUTE-GATE/1.0",
        ...(init.headers || {}),
      },
    });
    const raw = await response.text();
    let json = null;
    try { json = JSON.parse(raw); } catch {}
    return {
      ok: response.ok,
      status: response.status,
      raw: raw.slice(0, 2000),
      json,
      finalUrl: response.url,
      headers: {
        server: response.headers.get("server"),
        revision: response.headers.get("x-astra-revision"),
        railway: response.headers.get("x-railway-request-id"),
        vercel: response.headers.get("x-vercel-id"),
        netlify: response.headers.get("x-nf-request-id"),
      },
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      raw: "",
      json: null,
      finalUrl: url,
      headers: {},
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

function normalize(text) {
  return String(text ?? "").replaceAll("’", "'").toLowerCase();
}

function assertText(value, rule = {}) {
  const text = normalize(value);
  const failures = [];
  for (const fragment of rule.requireAll || []) {
    if (!text.includes(normalize(fragment))) failures.push(`missing: ${fragment}`);
  }
  if (rule.requireAny?.length && !rule.requireAny.some((fragment) => text.includes(normalize(fragment)))) {
    failures.push(`missing any: ${rule.requireAny.join(" | ")}`);
  }
  for (const fragment of rule.forbid || []) {
    if (text.includes(normalize(fragment))) failures.push(`forbidden: ${fragment}`);
  }
  return failures;
}

async function probeRevision(target) {
  const url = new URL(config.revisionPath || "/api/astra-revision", target.url);
  url.searchParams.set("_astra", expectedRevision.slice(0, 12));
  const result = await request(url.toString(), {}, Number(config.wait?.requestTimeoutMs || 15000));
  const sourceSha = String(result.json?.sourceSha || result.headers?.revision || "unknown");
  return {
    id: target.id,
    role: target.role,
    url: target.url,
    sourceSha,
    matchesExpected: result.ok && sourceSha === expectedRevision,
    ...result,
  };
}

function classify(samples) {
  const origin = samples.find((sample) => sample.role === "origin");
  const publicTarget = samples.find((sample) => sample.role === "public");
  if (!origin?.ok) return "ORIGIN_UNREACHABLE";
  if (!publicTarget?.ok) return "PUBLIC_UNREACHABLE";
  if (origin.sourceSha === "unknown") return "ORIGIN_UNSTAMPED";
  if (publicTarget.sourceSha === "unknown") return "PUBLIC_UNSTAMPED";
  if (origin.sourceSha !== expectedRevision) return "ORIGIN_STALE";
  if (publicTarget.sourceSha !== expectedRevision) return "PUBLIC_DOMAIN_STALE";
  if (origin.sourceSha !== publicTarget.sourceSha) return "ROUTE_MISMATCH";
  return "PASS";
}

async function functionalProbe(target, probe) {
  const url = new URL(probe.path || "/", target.url);
  url.searchParams.set("_astra_check", Date.now().toString());
  const init = { method: probe.method || "GET", headers: probe.headers || {} };
  if (probe.body !== undefined) {
    init.body = JSON.stringify(probe.body);
    init.headers = { "content-type": "application/json", ...(probe.headers || {}) };
  }
  const result = await request(url.toString(), init, Number(probe.timeoutMs || config.wait?.requestTimeoutMs || 15000));
  const failures = [];
  if (!(probe.expect?.statuses || [200]).includes(result.status)) failures.push(`HTTP ${result.status}`);
  if (probe.expect?.text) failures.push(...assertText(result.raw, probe.expect.text));
  if (probe.expect?.jsonText) {
    let selected = result.json;
    for (const key of String(probe.expect.jsonPath || "").split(".").filter(Boolean)) selected = selected?.[key];
    failures.push(...assertText(selected, probe.expect.jsonText));
  }
  return {
    target: target.id,
    id: probe.id,
    status: result.status,
    pass: failures.length === 0,
    failures,
    headers: result.headers,
    excerpt: result.raw.slice(0, 800),
  };
}

const startedAt = new Date().toISOString();
const deadline = Date.now() + Number(config.wait?.timeoutMs || 720000);
const intervalMs = Number(config.wait?.intervalMs || 10000);
let attempts = 0;
let routeState = "UNVERIFIED";
let samples = [];

do {
  attempts += 1;
  samples = [];
  for (const target of config.targets || []) samples.push(await probeRevision(target));
  routeState = classify(samples);
  console.log("ASTRA_PUBLIC_ROUTE_ATTEMPT", JSON.stringify({
    attempts,
    routeState,
    expectedRevision,
    targets: samples.map((sample) => ({
      id: sample.id,
      role: sample.role,
      status: sample.status,
      sourceSha: sample.sourceSha,
      matchesExpected: sample.matchesExpected,
      headers: sample.headers,
    })),
  }));
  if (routeState === "PASS") break;
  if (Date.now() < deadline) await sleep(intervalMs);
} while (Date.now() < deadline);

const functional = [];
if (routeState === "PASS") {
  for (const target of config.targets || []) {
    for (const probe of config.probes || []) {
      functional.push(await functionalProbe(target, probe));
    }
  }
}

const status = routeState === "PASS" && functional.every((probe) => probe.pass) ? "PASS" : "FAIL";
const evidence = {
  schema: "astra-public-route-gate/evidence-v1",
  startedAt,
  finishedAt: new Date().toISOString(),
  expectedRevision,
  attempts,
  routeState,
  status,
  targets: samples,
  functional,
};

fs.writeFileSync(path.join(evidenceDir, "evidence.json"), JSON.stringify(evidence, null, 2));
fs.writeFileSync(path.join(evidenceDir, "summary.md"), [
  "# ASTRA PUBLIC ROUTE GATE Ω",
  "",
  `- Status: **${status}**`,
  `- Route state: **${routeState}**`,
  `- Expected revision: \`${expectedRevision}\``,
  `- Attempts: ${attempts}`,
  "",
  "## Revision targets",
  ...samples.map((sample) =>
    `- ${sample.matchesExpected ? "PASS" : "FAIL"} ${sample.id} (${sample.role}) · HTTP ${sample.status} · \`${sample.sourceSha}\``
  ),
  "",
  "## Functional probes",
  ...(functional.length
    ? functional.map((probe) =>
        `- ${probe.pass ? "PASS" : "FAIL"} ${probe.target}/${probe.id} · HTTP ${probe.status}${probe.failures.length ? ` · ${probe.failures.join("; ")}` : ""}`
      )
    : ["- skipped until revisions converge"]),
].join("\n") + "\n");

console.log("ASTRA_PUBLIC_ROUTE_FINAL", JSON.stringify({
  status,
  routeState,
  expectedRevision,
  attempts,
}));

if (status !== "PASS") process.exit(1);
