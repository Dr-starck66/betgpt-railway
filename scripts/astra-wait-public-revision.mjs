#!/usr/bin/env node

const expected = String(process.argv[2] || process.env.GITHUB_SHA || "").trim();
const url = process.env.ASTRA_PUBLIC_REVISION_URL || "https://betgpt.live/api/health";
const timeoutMs = Math.max(30_000, Number(process.env.ASTRA_PUBLIC_SYNC_WAIT_MS || 240_000));
const intervalMs = Math.max(2_000, Number(process.env.ASTRA_PUBLIC_SYNC_WAIT_INTERVAL_MS || 5_000));

if (!/^[a-f0-9]{40}$/i.test(expected)) {
  console.error("ASTRA_PUBLIC_REVISION_WAIT_FAIL invalid expected SHA", expected);
  process.exit(2);
}

const deadline = Date.now() + timeoutMs;
let last = { status: 0, revision: "", error: "" };

while (Date.now() < deadline) {
  try {
    const response = await fetch(url, {
      headers: { "user-agent": "ASTRA-PUBLIC-REVISION-WAIT/1.0", "cache-control": "no-cache" },
      signal: AbortSignal.timeout(10_000),
      redirect: "follow",
    });
    const revision = String(response.headers.get("x-astra-public-revision") || "").trim();
    last = { status: response.status, revision, error: "" };
    console.log("ASTRA_PUBLIC_REVISION_WAIT", JSON.stringify({ expected, status: response.status, revision }));
    if (response.ok && revision === expected) {
      console.log("ASTRA_PUBLIC_REVISION_WAIT_PASS", expected);
      process.exit(0);
    }
  } catch (error) {
    last = { status: 0, revision: "", error: error instanceof Error ? error.message : String(error) };
    console.log("ASTRA_PUBLIC_REVISION_WAIT", JSON.stringify({ expected, ...last }));
  }
  await new Promise((resolve) => setTimeout(resolve, intervalMs));
}

console.error("ASTRA_PUBLIC_REVISION_WAIT_FAIL", JSON.stringify({ expected, url, last, timeoutMs }));
process.exit(1);
