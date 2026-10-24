import { defineEventHandler, setHeader } from "h3";
import { readLedgerDurable } from "../../../src/lib/editorial/ledger-store";
import { isPublicArticle } from "../../../src/lib/editorial/types";
import { parisDate } from "../../../src/lib/editorial/time";

/**
 * A public, read-only snapshot of already published auto articles.
 * The existing GitHub editorial scheduler synchronizes it into the permanent
 * source ledger; no Railway-to-GitHub write credential is needed.
 */
export default defineEventHandler(async (event) => {
  setHeader(event, "cache-control", "no-store");
  const now = new Date();
  const day = parisDate(now);
  const articles = (await readLedgerDurable())
    .filter(isPublicArticle)
    .filter((article) => /^ed-\d{4}-\d{2}-\d{2}-(morning|noon|evening)$/.test(article.id))
    .filter((article) => article.parisDate >= day.slice(0, 8) + "01")
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
    .slice(0, 24);
  return {
    schema: "betgpt-editorial-live-snapshot/v1",
    generatedAt: now.toISOString(),
    parisDate: day,
    articles,
  };
});
