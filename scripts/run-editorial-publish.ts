import { contextualAuthorityGate } from "../src/lib/editorial/authority-citations.ts";
import { sourceIntegrityGate } from "../src/lib/editorial/source-integrity.ts";
import { discoverLaunchpadStaticAudit, recentDiscoverCandidates } from "../src/lib/editorial/discover-launchpad.ts";
import { editionFromDesk } from "../src/lib/editorial/run.server.ts";
import { isPublicArticle } from "../src/lib/editorial/types.ts";
import { writeLedger } from "../src/lib/editorial/ledger-store.ts";
import { syncPublishedArticlesToSocial } from "../src/lib/social/run.server.ts";

const now = new Date();
const { edition } = await editionFromDesk(now);
const published = edition.articles.filter(isPublicArticle);
const integrityFailures = published
  .map((article) => ({ article, gate: sourceIntegrityGate(article) }))
  .filter(({ gate }) => !gate.pass);

if (integrityFailures.length) {
  for (const { article, gate } of integrityFailures) {
    console.error(`ASTRA_NEWS_SOURCE_INTEGRITY_FAIL ${article.slug}: ${gate.reasons.join(" | ")}`);
  }
  process.exit(2);
}

const authorityFailures = published
  .map((article) => ({ article, gate: contextualAuthorityGate(article) }))
  .filter(({ gate }) => !gate.pass);

if (authorityFailures.length) {
  for (const { article, gate } of authorityFailures) {
    console.error(`ASTRA_EDITORIAL_AUTHORITY_FAIL ${article.slug}: ${gate.reasons.join(" | ")}`);
  }
  process.exit(2);
}

const discoverCandidates = recentDiscoverCandidates(published, now, 48);
const discoverAudits = discoverCandidates.map((article) => discoverLaunchpadStaticAudit(article, now));
const discoverFailures = discoverAudits.filter((audit) => !audit.hardPass);

if (discoverFailures.length) {
  for (const audit of discoverFailures) {
    console.error(
      `ASTRA_DISCOVER_LAUNCHPAD_FAIL ${audit.slug}: ${audit.failures.join(" | ")}`,
    );
  }
  process.exit(2);
}

console.log(
  `ASTRA_DISCOVER_LAUNCHPAD_STATIC_PASS candidates=${discoverAudits.length} pass=${discoverAudits.filter((audit) => audit.verdict === "PASS").length} review=${discoverAudits.filter((audit) => audit.verdict === "REVIEW").length}`,
);

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
      discoverLaunchpad: {
        candidateWindowHours: 48,
        candidateCount: discoverAudits.length,
        pass: discoverFailures.length === 0,
        articles: discoverAudits.map((audit) => ({
          slug: audit.slug,
          verdict: audit.verdict,
          score: audit.score,
          warnings: audit.warnings,
        })),
      },
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
