import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dbSource, getSql } from "@/lib/db";
import type { SocialPublication } from "@/lib/social/types";

const memory = new Map<string, SocialPublication>();
const FILE = "data/social/ledger.json";
const REMOTE_LEDGER =
  (typeof process !== "undefined" && process.env.BETGPT_SOCIAL_LEDGER_URL?.trim()) ||
  "https://raw.githubusercontent.com/Dr-starck66/betgpt-railway/main/data/social/ledger.json";
const REMOTE_TTL_MS = 5 * 60 * 1000;
let hydratedFromDatabase = false;
let lastRemoteRead = 0;

function remember(rows: SocialPublication[]): SocialPublication[] {
  for (const row of rows) {
    if (!row?.id) continue;
    const previous = memory.get(row.id);
    if (previous?.status === "PUBLISHED" && row.status !== "PUBLISHED") continue;
    memory.set(row.id, row);
  }
  return [...memory.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function readSocialLedger(): SocialPublication[] {
  if (memory.size) return [...memory.values()];
  try {
    const parsed = JSON.parse(readFileSync(FILE, "utf8")) as SocialPublication[];
    return Array.isArray(parsed) ? remember(parsed) : [];
  } catch {
    return [];
  }
}

async function readRemoteLedger(): Promise<SocialPublication[]> {
  try {
    const response = await fetch(REMOTE_LEDGER, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
      headers: { "user-agent": "BetGPT-Astra-Social/1.0" },
    });
    if (!response.ok) return [];
    const parsed = (await response.json()) as SocialPublication[];
    if (!Array.isArray(parsed)) return [];
    lastRemoteRead = Date.now();
    return remember(parsed);
  } catch {
    return [];
  }
}

export async function readSocialLedgerDurable(): Promise<SocialPublication[]> {
  if (dbSource === "neon") {
    if (hydratedFromDatabase && memory.size) return [...memory.values()];
    try {
      const sql = await getSql();
      const rows = await sql.query<{ payload: SocialPublication }>(
        "select payload from social_publications order by updated_at desc limit 500",
      );
      hydratedFromDatabase = true;
      if (rows.length) return remember(rows.map((row) => row.payload));
    } catch {
      // Database unavailable or migration not applied: fall through to Git/file ledger.
    }
  }
  if (memory.size && Date.now() - lastRemoteRead < REMOTE_TTL_MS) return [...memory.values()];
  const remote = await readRemoteLedger();
  return remote.length ? remote : readSocialLedger();
}

export function writeSocialLedger(rows: SocialPublication[]): boolean {
  remember(rows);
  try {
    mkdirSync("data/social", { recursive: true });
    writeFileSync(FILE, JSON.stringify([...memory.values()], null, 2) + "\n");
    return true;
  } catch {
    return false;
  }
}

export async function writeSocialLedgerDurable(rows: SocialPublication[]): Promise<boolean> {
  remember(rows);
  if (!rows.length) return true;
  if (dbSource === "neon") {
    try {
      const sql = await getSql();
      for (const row of rows) {
        await sql.query(
          `insert into social_publications
             (id, article_id, network, status, published_at, remote_id, remote_url, retry_count, error, payload, updated_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,now())
           on conflict (id) do update set
             status = case when social_publications.status = 'PUBLISHED' then social_publications.status else excluded.status end,
             published_at = coalesce(social_publications.published_at, excluded.published_at),
             remote_id = coalesce(social_publications.remote_id, excluded.remote_id),
             remote_url = coalesce(social_publications.remote_url, excluded.remote_url),
             retry_count = greatest(social_publications.retry_count, excluded.retry_count),
             error = case when social_publications.status = 'PUBLISHED' then social_publications.error else excluded.error end,
             payload = case when social_publications.status = 'PUBLISHED' then social_publications.payload else excluded.payload end,
             updated_at = now()`,
          [
            row.id,
            row.articleId,
            row.network,
            row.status,
            row.publishedAt,
            row.remotePostId,
            row.remotePostUrl,
            row.retryCount,
            row.error,
            JSON.stringify(row),
          ],
        );
      }
      hydratedFromDatabase = true;
      return true;
    } catch {
      // Keep the Git/file ledger authoritative when the DB is unavailable.
    }
  }
  return writeSocialLedger(rows);
}
