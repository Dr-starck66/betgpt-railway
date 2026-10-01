import { contextualAuthorityGate } from "../src/lib/editorial/authority-citations.ts";
import { editionFromDesk } from "../src/lib/editorial/run.server.ts";
import { isPublicArticle } from "../src/lib/editorial/types.ts";
import { writeLedger } from "../src/lib/editorial/ledger-store.ts";
import { syncPublishedArticlesToSocial } from "../src/lib/social/run.server.ts";

const now = new Date();
const { edition } = await editionFromDesk(now);
const published = edition.articles.filter(isPublicArticle);
const AUTHORITY_CUTOVER_MS = Date.parse("2026-10-01T21:03:00.000Z");
const authorityFailures = published
  .filter((article) => {
    const created = Date.parse(article.createdAt);
    return Number.isFinite(created) && created >= AUTHORITY_CUTOVER_MS;
  })
  .map((article) => ({ article, gate: contextualAuthorityGate(article) }))
  .filter(({ gate }) => !gate.pass);

if (authorityFailures.length) {
  for (const { article, gate } of authorityFailures) {
    console.error(`ASTRA_EDITORIAL_AUTHORITY_FAIL ${article.slug}: ${gate.reasons.join(" | ")}`);
  }
  process.exit(2);
}

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
