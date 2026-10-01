#!/usr/bin/env node

const publicUrl = process.env.ASTRA_PUBLIC_REVISION_URL || "https://betgpt.live/api/astra-revision";
const canonicalUrl =
  process.env.ASTRA_CANONICAL_REVISION_URL ||
  "https://betgpt-production-7353.up.railway.app/api/astra-revision";
const timeoutMs = Math.max(30_000, Number(process.env.ASTRA_PUBLIC_SYNC_WAIT_MS || 240_000));
const intervalMs = Math.max(2_000, Number(process.env.ASTRA_PUBLIC_SYNC_WAIT_INTERVAL_MS || 5_000));

async function readRevision(url) {
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "ASTRA-PUBLIC-CANONICAL-CONVERGENCE/1.0",
        accept: "application/json,text/plain,*/*",
        "cache-control": "no-cache",
      },
      signal: AbortSignal.timeout(10_000),
      redirect: "follow",
    });
    const text = await response.text();
    let sourceSha = "";
    try {
      const parsed = JSON.parse(text);
      sourceSha = String(parsed?.sourceSha || "").trim();
    } catch {}
    sourceSha ||= String(response.headers.get("x-astra-revision") || "").trim();
    sourceSha ||= String(response.headers.get("x-astra-public-revision") || "").trim();
    return {
      ok: response.ok && /^[a-f0-9]{40}$/i.test(sourceSha),
      status: response.status,
      sourceSha,
      proxy: response.headers.get("x-astra-public-proxy") || "",
      error: "",
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      sourceSha: "",
      proxy: "",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

const deadline = Date.now() + timeoutMs;
let last = null;

while (Date.now() < deadline) {
  const [publicRevision, canonicalRevision] = await Promise.all([
    readRevision(publicUrl),
    readRevision(canonicalUrl),
  ]);
  const equal =
    publicRevision.ok &&
    canonicalRevision.ok &&
    publicRevision.sourceSha === canonicalRevision.sourceSha;

  last = { publicRevision, canonicalRevision, equal };
  console.log("ASTRA_PUBLIC_CANONICAL_WAIT", JSON.stringify(last));

  if (equal) {
    console.log(
      "ASTRA_PUBLIC_CANONICAL_WAIT_PASS",
      JSON.stringify({
        sourceSha: publicRevision.sourceSha,
        proxy: publicRevision.proxy || null,
      }),
    );
    process.exit(0);
  }

  await new Promise((resolve) => setTimeout(resolve, intervalMs));
}

console.error(
  "ASTRA_PUBLIC_CANONICAL_WAIT_FAIL",
  JSON.stringify({ publicUrl, canonicalUrl, timeoutMs, last }),
);
process.exit(1);
