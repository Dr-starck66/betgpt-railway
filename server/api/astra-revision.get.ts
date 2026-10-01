import fs from "node:fs";
import path from "node:path";
import { defineEventHandler, setHeader } from "h3";

export default defineEventHandler((event) => {
  let revision = { schema: "astra-public-route-revision/v1", sourceSha: "unknown", generatedAt: null as string | null };
  try {
    const file = path.resolve("public/astra-revision.json");
    if (fs.existsSync(file)) revision = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {}
  setHeader(event, "cache-control", "no-store, no-cache, must-revalidate, max-age=0");
  setHeader(event, "x-astra-revision", String(revision.sourceSha || "unknown"));
  return revision;
});
