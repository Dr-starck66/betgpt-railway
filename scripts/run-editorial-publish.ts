import { editionFromDesk } from "../src/lib/editorial/run.server.ts";
import { isPublicArticle } from "../src/lib/editorial/types.ts";
import { writeLedger } from "../src/lib/editorial/ledger-store.ts";

const now = new Date();
const { edition } = await editionFromDesk(now);
const published = edition.articles.filter(isPublicArticle);
const persisted = writeLedger(published);

console.log(
  JSON.stringify(
    {
      ok: persisted,
      generatedAt: edition.generatedAt,
      parisDate: edition.parisDate,
      targetPerDay: edition.targetPerDay,
      targetStatus: edition.targetStatus,
      published: published.map((article) => ({
        id: article.id,
        slug: article.slug,
        slot: article.slot,
        status: article.status,
        publishedAt: article.publishedAt,
      })),
      skipped: edition.skipped,
    },
    null,
    2,
  ),
);

if (!persisted) process.exit(2);
