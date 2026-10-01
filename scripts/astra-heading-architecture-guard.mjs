import { readFileSync } from "node:fs";
import { manualEditorialArticles } from "../src/lib/editorial/manual-articles.ts";
import { headingArchitectureReasons } from "../src/lib/editorial/quality.ts";

const strict = process.argv.includes("--strict");
const failures = [];

for (const article of manualEditorialArticles()) {
  const reasons = headingArchitectureReasons(article.paragraphs);
  for (const reason of reasons) failures.push(`${article.slug}: ${reason}`);

  for (const paragraph of article.paragraphs) {
    if (paragraph.body.trim().length >= 1200 && !(paragraph.subsections?.length)) {
      failures.push(`${article.slug}: bloc H2 très long sans sous-structure — ${paragraph.h2}`);
    }
  }
}

const renderer = readFileSync(new URL("../src/components/news-article.tsx", import.meta.url), "utf8");
if (!renderer.includes("<h3")) failures.push("renderer: balise H3 absente");
if (!renderer.includes("<h4")) failures.push("renderer: balise H4 absente");

if (failures.length) {
  console.error("ASTRA_HEADING_ARCHITECTURE_FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  if (strict) process.exit(1);
} else {
  console.log("ASTRA_HEADING_ARCHITECTURE_PASS");
}
