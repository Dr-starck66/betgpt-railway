import fs from "node:fs";
import path from "node:path";
import { auditSidewingOpportunity, recommendedLinkBudget } from "../src/lib/seo/astra-sidewing-auditor.ts";

const ROOT = process.cwd();
const ROUTES = path.join(ROOT, "src", "routes");

function filesIn(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory() ? filesIn(path.join(dir, entry.name)) : [path.join(dir, entry.name)],
    )
    .filter((file) => file.endsWith(".tsx"));
}

function count(re, text) {
  const flags = re.flags.includes("g") ? re.flags : `${re.flags}g`;
  return [...text.matchAll(new RegExp(re.source, flags))].length;
}

function classify(file) {
  const route = path.basename(file).replace(/\.tsx$/, "");
  if (/actualites|actu/.test(route)) return "news";
  if (/blog/.test(route)) return "article";
  if (/guides/.test(route)) return "guide";
  if (/match|prediction/.test(route)) return "match";
  if (/cotes|comparer/.test(route)) return "comparison";
  if (/equipe/.test(route)) return "entity";
  if (/resultat|score\./.test(route)) return "result";
  if (/index$|pronostics|scores-en-direct|resultats-football|statistics|classement|calendrier/.test(route)) return "hub";
  if (/calculateur|outils/.test(route)) return "tool";
  return "other";
}

function intent(kind) {
  if (kind === "comparison") return "comparative";
  if (kind === "tool" || kind === "match") return "transactional";
  if (kind === "hub") return "mixed";
  return "informational";
}

function widthGuess(text) {
  const matches = [...text.matchAll(/max-w-\[(\d+)px\]|max-w-(3xl|4xl|5xl|6xl|7xl)/g)];
  if (!matches.length) return 1120;
  const map = { "3xl": 768, "4xl": 896, "5xl": 1024, "6xl": 1152, "7xl": 1280 };
  const values = matches.map((m) => (m[1] ? Number(m[1]) : map[m[2]] ?? 1120));
  return Math.min(...values);
}

function routeDepth(file) {
  const base = path.basename(file).replace(/\.tsx$/, "");
  return 1 + count(/[.$]/g, base);
}

function wordCount(text) {
  const stripped = text
    .replace(/import[\s\S]*?from\s+["'][^"']+["'];?/g, " ")
    .replace(/[{}()[\],;:=<>/]/g, " ");
  return stripped.split(/\s+/).filter((word) => word.length >= 3).length;
}

const rows = filesIn(ROUTES).map((file) => {
  const source = fs.readFileSync(file, "utf8");
  const redirect = /throw redirect\(/.test(source);
  const noindex = /name:\s*["']robots["'][\s\S]{0,160}?noindex/.test(source);
  const canonical = /rel:\s*["']canonical["']/.test(source);
  const kind = classify(file);
  const internalLinks = count(/<(?:Link|a)\b/g, source);
  const hrefTargets = [...source.matchAll(/(?:href|to)=["'`{][^>\n]*/g)].map((m) => m[0]);
  const uniqueTargets = new Set(hrefTargets).size;
  const duplicateRatio = internalLinks > 0 ? Math.max(0, 1 - uniqueTargets / internalLinks) : 0;
  const structured = /application\/ld\+json|ld\(/.test(source);
  const breadcrumbs = /breadcrumb|crumbs/i.test(source);
  const sidewings = /AstraSidewings/.test(source);
  const relatedModules = count(/<CoconMesh\b|id=["']lire-aussi["']|À lire aussi|related/i, source);
  const entityCount = count(/\.home\.|\.away\.|team|article\.category|competition/gi, source);
  const headings = count(/<h[1-6]\b/g, source);
  const width = widthGuess(source);

  const result = auditSidewingOpportunity({
    pageKind: kind,
    searchIntent: intent(kind),
    viewportWidth: 1440,
    primaryContentWidth: width,
    contentWordCount: wordCount(source),
    headingCount: headings,
    contextualInternalLinks: internalLinks,
    uniqueInternalTargets: uniqueTargets,
    relatedModules,
    entityCount,
    pageDepth: routeDepth(file),
    hasBreadcrumbs: breadcrumbs,
    hasStructuredData: structured,
    hasMobileLinkParity: true,
    indexable: !noindex,
    selfCanonical: canonical || redirect,
    isRedirect: redirect,
    duplicateLinkRatio: duplicateRatio,
    thinContentRisk: wordCount(source) < 120 && !redirect,
    hasVisibleTrustSignals: /source|method|author|auteur|preuve|ledger/i.test(source),
  });

  return {
    route: path.relative(ROOT, file).replaceAll("\\", "/"),
    kind,
    currentSidewings: sidewings,
    width,
    links: internalLinks,
    verdict: result.verdict,
    sidewingNeed: result.sidewingNeed,
    seoOpportunity: result.seoOpportunity,
    confidence: result.confidence,
    linkBudget: recommendedLinkBudget(result),
    families: result.families.map((f) => `${f.side}:${f.family}`).join(","),
    risks: result.seoRisks.join(" | "),
  };
});

const order = { PRIORITY: 0, RECOMMENDED: 1, OPTIONAL: 2, SKIP: 3 };
rows.sort((a, b) => order[a.verdict] - order[b.verdict] || b.seoOpportunity - a.seoOpportunity || b.sidewingNeed - a.sidewingNeed);

const summary = rows.reduce((acc, row) => {
  acc[row.verdict] = (acc[row.verdict] ?? 0) + 1;
  return acc;
}, {});

const report = { generatedAt: new Date().toISOString(), summary, rows };
fs.mkdirSync(path.join(ROOT, "reports"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "reports", "astra-sidewing-audit.json"), JSON.stringify(report, null, 2));

console.log("ASTRA SIDEWING AUDITOR Ω");
console.log(JSON.stringify(summary));
console.table(rows.slice(0, 30));
