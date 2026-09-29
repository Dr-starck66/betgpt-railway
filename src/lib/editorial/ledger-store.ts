import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { EditorialArticle } from "@/lib/editorial/types";
import { getSql } from "@/lib/db";

const memory = new Map<string, EditorialArticle>();
const FILE = "data/editorial/ledger.json";
let hydratedFromDatabase = false;

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

export async function readLedgerDurable(): Promise<EditorialArticle[]> {
  if (hydratedFromDatabase && memory.size) return [...memory.values()];
  try {
    const sql = await getSql();
    const rows = await sql.query<{ payload: EditorialArticle }>(
      "select payload from editorial_articles order by coalesce(published_at, updated_at) desc limit 250",
    );
    hydratedFromDatabase = true;
    if (rows.length) return remember(rows.map((row) => row.payload));
  } catch {
    // Local preview or missing migration: fall back to file/memory below.
  }
  return readLedger();
}

export function writeLedger(articles: EditorialArticle[]): boolean {
  remember(articles);
  try {
    mkdirSync("data/editorial", { recursive: true });
    writeFileSync(FILE, JSON.stringify([...memory.values()]));
    return true;
  } catch {
    return false;
  }
}

export async function writeLedgerDurable(articles: EditorialArticle[]): Promise<boolean> {
  remember(articles);
  if (!articles.length) return true;
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
          article.id,
          article.parisDate,
          article.slot,
          article.status,
          article.publishedAt,
          article.modifiedAt,
          JSON.stringify(article),
        ],
      );
    }
    hydratedFromDatabase = true;
    return true;
  } catch {
    return writeLedger(articles);
  }
}
