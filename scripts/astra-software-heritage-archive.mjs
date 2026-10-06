import fs from "node:fs/promises";
import path from "node:path";

const ORIGIN = "https://github.com/Dr-starck66/betgpt-railway";
const API = "https://archive.softwareheritage.org";
const OUT = path.resolve("data/authority/software-heritage.json");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function jsonFetch(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      accept: "application/json",
      "user-agent": "ASTRA-AUTHORITY-CITATION-ENGINE/1.0 (+https://betgpt.live/press)",
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(30000),
  });
  const raw = await res.text();
  let data = null;
  try { data = JSON.parse(raw); } catch { data = { raw }; }
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}: ${raw.slice(0,500)}`);
  return data;
}

const saveUrl = new URL(`${API}/api/1/origin/save/`);
saveUrl.searchParams.set("visit_type", "git");
saveUrl.searchParams.set("origin_url", ORIGIN);

const created = await jsonFetch(saveUrl.toString(), {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: "{}",
});

const requestId = Number(created.id);
if (!requestId) throw new Error("SWH_SAVE_NO_REQUEST_ID");

console.log("ASTRA_SWH_SAVE_ACCEPTED", JSON.stringify({
  requestId,
  saveRequestStatus: created.save_request_status,
  saveTaskStatus: created.save_task_status,
}));

let current = created;
for (let attempt = 1; attempt <= 50; attempt += 1) {
  current = await jsonFetch(`${API}/api/1/origin/save/${requestId}/`);
  console.log("ASTRA_SWH_POLL", JSON.stringify({
    attempt,
    requestId,
    saveRequestStatus: current.save_request_status,
    saveTaskStatus: current.save_task_status,
    snapshotSwhid: current.snapshot_swhid || null,
  }));
  if (current.save_task_status === "succeeded" && current.snapshot_swhid) break;
  if (["failed"].includes(String(current.save_task_status))) {
    throw new Error(`SWH_SAVE_TASK_${current.save_task_status}`);
  }
  if (current.save_request_status === "rejected") {
    throw new Error(`SWH_SAVE_REQUEST_REJECTED: ${current.note || ""}`);
  }
  await sleep(6000);
}

if (current.save_task_status !== "succeeded" || !current.snapshot_swhid) {
  throw new Error(`SWH_SAVE_NOT_COMPLETE status=${current.save_task_status || "unknown"}`);
}

const proof = {
  schema: "astra-third-party-archive/v1",
  provider: "Software Heritage",
  providerUrl: "https://www.softwareheritage.org/",
  origin: ORIGIN,
  archivedAt: current.visit_date || new Date().toISOString(),
  visitStatus: current.visit_status || null,
  snapshotSwhid: current.snapshot_swhid,
  persistentUrl: `${API}/${current.snapshot_swhid}`,
  requestId,
  requestUrl: `${API}/api/1/origin/save/${requestId}/`,
  status: "PASS",
};

await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify(proof, null, 2) + "\n");

console.log("ASTRA_THIRD_PARTY_ARCHIVE_PASS", JSON.stringify(proof));
