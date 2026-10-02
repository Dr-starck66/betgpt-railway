#!/usr/bin/env node

const SOURCE_REPO = process.env.ASTRA_SOURCE_REPO || "Dr-starck66/betgpt-railway";
const WRAPPER_REPO = process.env.ASTRA_WRAPPER_REPO || "Dr-starck66/zip-github";
const WRAPPER_BRANCH = process.env.ASTRA_WRAPPER_BRANCH || "main";
const WRAPPER_ROOT = process.env.ASTRA_WRAPPER_ROOT || "betgpt-railway-live";
const PUBLIC_ORIGIN = process.env.ASTRA_PUBLIC_ORIGIN || "https://betgpt.live";
const CANONICAL_ORIGIN =
  process.env.ASTRA_CANONICAL_ORIGIN || "https://betgpt-production-7353.up.railway.app";
const REQUIRED_FIX_SHA = String(process.env.ASTRA_REQUIRED_FIX_SHA || "").trim();

function validSha(value) {
  return /^[a-f0-9]{40}$/i.test(String(value || ""));
}

async function getJson(url, label) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent": "ASTRA-GREEN-PUBLIC-SYNC/1.0",
      accept: "application/json",
      "cache-control": "no-cache",
    },
    signal: AbortSignal.timeout(20000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${label}: HTTP ${response.status}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label}: invalid JSON`);
  }
}

async function requireAncestor(base, head) {
  if (base.toLowerCase() === head.toLowerCase()) return { status: "identical", mergeBase: base };
  const url =
    `https://api.github.com/repos/${SOURCE_REPO}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`;
  const data = await getJson(url, "ancestry");
  const mergeBase = String(data?.merge_base_commit?.sha || "");
  if (!["ahead", "identical"].includes(String(data?.status || "")) || mergeBase.toLowerCase() !== base.toLowerCase()) {
    throw new Error(`required fix ${base} is not an ancestor of GREEN release ${head}`);
  }
  return { status: data.status, mergeBase };
}

const rawBase =
  `https://raw.githubusercontent.com/${WRAPPER_REPO}/${WRAPPER_BRANCH}/${WRAPPER_ROOT}`;
const [green, manifest, publicRevision, canonicalRevision, publicHealth] = await Promise.all([
  getJson(`${rawBase}/.astra-green-release.json`, "green marker"),
  getJson(`${rawBase}/source-manifest.json`, "source manifest"),
  getJson(`${PUBLIC_ORIGIN}/api/astra-revision`, "public revision"),
  getJson(`${CANONICAL_ORIGIN}/api/astra-revision`, "canonical revision"),
  getJson(`${PUBLIC_ORIGIN}/api/health`, "public health"),
]);

const failures = [];
const greenSha = String(green?.sourceSha || "");
const manifestSha = String(manifest?.sourceSha || "");
const publicSha = String(publicRevision?.sourceSha || "");
const canonicalSha = String(canonicalRevision?.sourceSha || "");

if (!["astra-green-release/v1", "astra-green-release/v2"].includes(String(green?.schema || ""))) {
  failures.push("invalid-green-schema");
}
if (green?.greenVerified !== true) failures.push("green-not-verified");
if (String(green?.sourceRepo || "") !== SOURCE_REPO) failures.push("green-source-repo-mismatch");
if (!validSha(greenSha)) failures.push("green-sha-invalid");
if (String(manifest?.sourceRepo || "") !== SOURCE_REPO) failures.push("manifest-source-repo-mismatch");
if (manifestSha !== greenSha) failures.push("manifest-green-sha-mismatch");
if (String(publicRevision?.sourceRepo || "") !== SOURCE_REPO) failures.push("public-source-repo-mismatch");
if (publicSha !== greenSha) failures.push("public-green-sha-mismatch");
if (canonicalSha !== greenSha) failures.push("canonical-green-sha-mismatch");
if (String(publicHealth?.status || "").toLowerCase() !== "ok") failures.push("public-health-not-ok");
if (String(green?.promotionKey || "") !== `${SOURCE_REPO}@${greenSha}`) failures.push("promotion-key-mismatch");

let ancestry = null;
if (!failures.length && REQUIRED_FIX_SHA) {
  if (!validSha(REQUIRED_FIX_SHA)) {
    failures.push("required-fix-sha-invalid");
  } else {
    try {
      ancestry = await requireAncestor(REQUIRED_FIX_SHA, greenSha);
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }
}

const evidence = {
  schema: "astra-green-public-sync/v1",
  checkedAt: new Date().toISOString(),
  sourceRepo: SOURCE_REPO,
  greenSha: greenSha || null,
  manifestSha: manifestSha || null,
  publicSha: publicSha || null,
  canonicalSha: canonicalSha || null,
  requiredFixSha: REQUIRED_FIX_SHA || null,
  ancestry,
  workflowRunId: green?.workflowRunId ?? null,
  verifiedAt: green?.verifiedAt ?? null,
  status: failures.length ? "FAIL" : "PASS",
  failures,
};

console.log("ASTRA_GREEN_PUBLIC_SYNC", JSON.stringify(evidence));
if (failures.length) process.exit(1);
