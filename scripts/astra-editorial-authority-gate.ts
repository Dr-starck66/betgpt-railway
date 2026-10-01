import { contextualAuthorityGate } from "../src/lib/editorial/authority-citations.ts";
import { manualEditorialArticles } from "../src/lib/editorial/manual-articles.ts";
import { isPublicArticle } from "../src/lib/editorial/types.ts";

const articles = manualEditorialArticles().filter(isPublicArticle);
const failures = articles
  .map((article) => ({ article, gate: contextualAuthorityGate(article) }))
  .filter(({ gate }) => !gate.pass);

if (failures.length) {
  for (const { article, gate } of failures) {
    console.error(
      `ASTRA_EDITORIAL_AUTHORITY_FAIL ${article.slug}: ${gate.reasons.join(" | ")}`,
    );
  }
  process.exit(1);
}

console.log(
  `ASTRA_EDITORIAL_AUTHORITY_PASS audited=${articles.length} recursive_headings=true official_first=true fail_closed=true`,
);
