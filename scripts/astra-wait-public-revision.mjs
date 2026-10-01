#!/usr/bin/env node

const expected = String(process.argv[2] || process.env.GITHUB_SHA || "").trim();
const url = process.env.ASTRA_PUBLIC_REVISION_URL || "https://betgpt.live/api/health";
const repo = process.env.ASTRA_SYNC_REPO || "Dr-starck66/betgpt-railway";
const timeoutMs = Math.max(30_000, Number(process.env.ASTRA_PUBLIC_SYNC_WAIT_MS || 240_000));
const intervalMs = Math.max(2_000, Number(process.env.ASTRA_PUBLIC_SYNC_WAIT_INTERVAL_MS || 5_000));

if (!/^[a-f0-9]{40}$/i.test(expected)) {
  console.error("ASTRA_PUBLIC_REVISION_WAIT_FAIL invalid expected SHA", expected);
  process.exit(2);
}

const relationCache = new Map();

async function containsExpected(current) {
  if (!/^[a-f0-9]{40}$/i.test(current)) return false;
  if (current === expected) return true;
  if (relationCache.has(current)) return relationCache.get(current);

  try {
    const compare = await fetch(
      `https://api.github.com/repos/${repo}/compare/${expected}...${current}`,
      {
        headers: {
          "user-agent": "ASTRA-PUBLIC-REVISION-WAIT/2.0",
          accept: "application/vnd.github+json",
        },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!compare.ok) {
      relationCache.set(current, false);
      return false;
    }
    const data = await compare.json();
    const ok = data.status === "ahead" || data.status === "identical";
    relationCache.set(current, ok);
    return ok;
  } catch {
    return false;
  }
}

const deadline = Date.now() + timeoutMs;
let last = { status: 0, revision: "", relation: false, error: "" };

while (Date.now() < deadline) {
  try {
    const response = await fetch(url, {
      headers: { "user-agent": "ASTRA-PUBLIC-REVISION-WAIT/2.0", "cache-control": "no-cache" },
      signal: AbortSignal.timeout(10_000),
      redirect: "follow",
    });
    const revision = String(response.headers.get("x-astra-public-revision") || "").trim();
    const relation = response.ok ? await containsExpected(revision) : false;
    last = { status: response.status, revision, relation, error: "" };
    console.log("ASTRA_PUBLIC_REVISION_WAIT", JSON.stringify({ expected, status: response.status, revision, relation }));
    if (response.ok && relation) {
      console.log("ASTRA_PUBLIC_REVISION_WAIT_PASS", JSON.stringify({ expected, revision }));
      process.exit(0);
    }
  } catch (error) {
    last = { status: 0, revision: "", relation: false, error: error instanceof Error ? error.message : String(error) };
    console.log("ASTRA_PUBLIC_REVISION_WAIT", JSON.stringify({ expected, ...last }));
  }
  await new Promise((resolve) => setTimeout(resolve, intervalMs));
}

console.error("ASTRA_PUBLIC_REVISION_WAIT_FAIL", JSON.stringify({ expected, url, repo, last, timeoutMs }));
process.exit(1);
