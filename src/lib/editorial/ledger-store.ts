import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { EditorialArticle } from "@/lib/editorial/types";
import { dbSource, getSql } from "@/lib/db";

const memory = new Map<string, EditorialArticle>();
const FILE = "data/editorial/ledger.json";
const REMOTE_LEDGER =
  (typeof process !== "undefined" && process.env.BETGPT_EDITORIAL_LEDGER_URL?.trim()) ||
  "https://raw.githubusercontent.com/Dr-starck66/betgpt-railway/main/data/editorial/ledger.json";
const REMOTE_TTL_MS = 5 * 60 * 1000;
let hydratedFromDatabase = false;
let lastRemoteRead = 0;

function remember(articles: EditorialArticle[]): EditorialArticle[] {
  for (const article of articles) {
    if (article?.id) memory.set(article.id, article);
  }
  return [...memory.values()];
}

export function readLedger(): EditorialArticle[] {
  if (memory.size) return [...memory.values()];
  try {
    const parsed = JSON.parse(readFileSync(FILE, "utf8")) as EditorialArticle[];
    if (!Array.isArray(parsed)) return [];
    return remember(parsed);
  } catch {
    return [];
  }
}

async function readRemoteLedger(): Promise<EditorialArticle[]> {
  try {
    const response = await fetch(REMOTE_LEDGER, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
      headers: { "user-agent": "BetGPT-Editorial-Ledger/1.0" },
    });
    if (!response.ok) return [];
    const parsed = (await response.json()) as EditorialArticle[];
    if (!Array.isArray(parsed)) return [];
    lastRemoteRead = Date.now();
    return remember(parsed);
  } catch {
    return [];
  }
}

export async function readLedgerDurable(): Promise<EditorialArticle[]> {
  // CI/release gates must audit the exact immutable checkout, never a CDN-delayed
  // raw GitHub copy of the ledger from another revision.
  if (process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true") {
    return readLedger();
  }

  // Preserve historic Git-backed articles while independently loading the
  // durable database. Database rows win when the public Git ledger is stale.
  if (memory.size && Date.now() - lastRemoteRead < REMOTE_TTL_MS && hydratedFromDatabase) {
    return [...memory.values()];
  }
  const remote = await readRemoteLedger();
  if (dbSource === "neon") {
    try {
      const sql = await getSql();
      const rows = await sql.query<{ payload: EditorialArticle }>(
        "select payload from editorial_articles order by coalesce(published_at, updated_at) desc limit 250",
      );
      hydratedFromDatabase = true;
      return remember([...remote, ...rows.map((row) => row.payload)]);
    } catch (error) {
      hydratedFromDatabase = false;
      console.error("ASTRA_EDITORIAL_DURABLE_READ_FAILED", String(error).slice(0, 180));
      // Historic public content remains available, but writes must fail closed.
    }
  }
  if (remote.length) return remember(remote);
  return readLedger();
}

export function writeLedger(articles: EditorialArticle[]): boolean {
  remember(articles);
  try {
    mkdirSync("data/editorial", { recursive: true });
    writeFileSync(FILE, JSON.stringify([...memory.values()], null, 2) + "\n");
    return true;
  } catch {
    return false;
  }
}

export async function writeLedgerDurable(articles: EditorialArticle[]): Promise<boolean> {
  if (!articles.length) return true;
  if (dbSource === "neon") {
    try {
      const sql = await getSql();
      for (const article of articles) {
        await sql.query(
          `insert into editorial_articles (id, paris_date, slot, status, published_at, modified_at, payload, updated_at)
           values ($1, $2, $3, $4, $5, $6, $7::jsonb, now())
           on conflict (id) do update set
             paris_date = excluded.paris_date,
             slot = excluded.slot,
             status = excluded.status,
             published_at = excluded.published_at,
             modified_at = excluded.modified_at,
             payload = excluded.payload,
             updated_at = now()`,
          [
            article.id, article.parisDate, article.slot, article.status,
            article.publishedAt, article.modifiedAt, JSON.stringify(article),
          ],
        );
      }
      // A commit/ack without a database readback is not proof of persistence.
      const ids = articles.map((article) => article.id);
      const persisted = await sql.query<{ id: string; payload: EditorialArticle }>(
        "select id, payload from editorial_articles where id = ANY($1::text[])", [ids],
      );
      const proven = new Map(persisted.map((row) => [row.id, row.payload]));
      if (!articles.every((article) =>
        proven.get(article.id)?.slug === article.slug &&
        proven.get(article.id)?.publishedAt === article.publishedAt
      )) {
        console.error("ASTRA_EDITORIAL_DURABLE_READBACK_FAILED", JSON.stringify({ count: articles.length }));
        return false;
      }
      remember(articles);
      hydratedFromDatabase = true;
      console.info("ASTRA_EDITORIAL_DURABLE_WRITE_PASS", JSON.stringify({ count: articles.length, ids }));
      return true;
    } catch (error) {
      console.error("ASTRA_EDITORIAL_DURABLE_WRITE_FAILED", String(error).slice(0, 180));
      return false;
    }
  }
  if (process.env.RAILWAY_ENVIRONMENT_ID || (process.env.NODE_ENV === "production" && process.env.CI !== "true")) {
    console.error("ASTRA_EDITORIAL_DURABLE_WRITE_BLOCKED", "DATABASE_URL required for production");
    return false;
  }
  // Development-only file cache. Never count it as a durable production write.
  return writeLedger(articles);
}
