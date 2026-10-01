import { editionFromDesk } from "../src/lib/editorial/run.server.ts";
import { isPublicArticle } from "../src/lib/editorial/types.ts";
import { writeLedger } from "../src/lib/editorial/ledger-store.ts";
import { syncPublishedArticlesToSocial } from "../src/lib/social/run.server.ts";

const now = new Date();
const { edition } = await editionFromDesk(now);
const published = edition.articles.filter(isPublicArticle);
const persisted = writeLedger(published);
const social = await syncPublishedArticlesToSocial(published, now);

console.log(
  JSON.stringify(
    {
      ok: persisted && social.persisted,
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
      social: {
        provider: social.provider,
        created: social.created.map((row) => ({
          id: row.id,
          articleId: row.articleId,
          status: row.status,
          hashtags: row.hashtags,
          trackedUrl: row.trackedUrl,
        })),
        publishAttempts: social.publishAttempts,
        persisted: social.persisted,
      },
      skipped: edition.skipped,
    },
    null,
    2,
  ),
);

if (!persisted || !social.persisted) process.exit(2);
