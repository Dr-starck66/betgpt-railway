import { sourceQualityScore, paragraphText } from "@/lib/editorial/quality";
import { isPublicArticle, type EditorialArticle } from "@/lib/editorial/types";

export type DiscoverLaunchpadVerdict = "PASS" | "REVIEW" | "FAIL";

export type DiscoverLaunchpadStaticReport = {
  articleId: string;
  slug: string;
  verdict: DiscoverLaunchpadVerdict;
  hardPass: boolean;
  score: number;
  publishedAt: string | null;
  ageHours: number | null;
  newsSitemapEligible: boolean;
  checks: {
    PUBLIC: boolean;
    QUALITY_GATE: boolean;
    SOURCE_STRENGTH: boolean;
    IMAGE_WIDTH_1200: boolean;
    IMAGE_PIXELS_300K: boolean;
    IMAGE_LANDSCAPE: boolean;
    NON_CLICKBAIT: boolean;
    ORIGINAL_VALUE: boolean;
    DEEP_ENOUGH: boolean;
    TIMELY_24H: boolean;
    TOPIC_FOCUS: boolean;
    VISUAL_NOT_SITE_BRAND: boolean;
  };
  warnings: string[];
  failures: string[];
};

function finiteAgeHours(publishedAt: string | null, nowMs: number): number | null {
  const ms = Date.parse(publishedAt ?? "");
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, (nowMs - ms) / 36e5);
}

function landscape(width: number, height: number): boolean {
  if (width <= 0 || height <= 0) return false;
  const ratio = width / height;
  return ratio >= 1.45 && ratio <= 2.05;
}

function topicFocused(article: EditorialArticle): boolean {
  const haystack = `${article.h1} ${article.lead} ${article.competition} ${article.teams.join(" ")}`.toLowerCase();
  return (
    article.teams.some((team) => team.length >= 3 && haystack.includes(team.toLowerCase())) ||
    (article.competition.length >= 3 && haystack.includes(article.competition.toLowerCase()))
  );
}

export function discoverLaunchpadStaticAudit(
  article: EditorialArticle,
  now = new Date(),
): DiscoverLaunchpadStaticReport {
  const ageHours = finiteAgeHours(article.publishedAt, now.getTime());
  const body = article.paragraphs.map(paragraphText).join(" ");
  const sourceStrength = sourceQualityScore(article.sources);
  const pixels = Number(article.image.width || 0) * Number(article.image.height || 0);
  const imageSrc = String(article.image.src || "").toLowerCase();

  const checks = {
    PUBLIC: isPublicArticle(article),
    QUALITY_GATE: article.quality.pass,
    SOURCE_STRENGTH: sourceStrength >= 6,
    IMAGE_WIDTH_1200: article.image.width >= 1200,
    IMAGE_PIXELS_300K: pixels > 300_000,
    IMAGE_LANDSCAPE: landscape(article.image.width, article.image.height),
    NON_CLICKBAIT: article.discoverChecks.NON_CLICKBAIT_TITLE,
    ORIGINAL_VALUE: article.discoverChecks.ORIGINAL_VALUE && article.duplicateScore < 0.66,
    DEEP_ENOUGH:
      article.articleType === "news"
        ? body.trim().length >= 2400 && article.paragraphs.length >= 5
        : body.trim().length >= 650 && article.paragraphs.length >= 3,
    TIMELY_24H: ageHours != null && ageHours <= 24,
    TOPIC_FOCUS: topicFocused(article),
    VISUAL_NOT_SITE_BRAND: !/logo-betgpt|og-betgpt|hero-desk/.test(imageSrc),
  };

  const failures: string[] = [];
  const warnings: string[] = [];
  const hard = [
    ["PUBLIC", checks.PUBLIC],
    ["QUALITY_GATE", checks.QUALITY_GATE],
    ["SOURCE_STRENGTH", checks.SOURCE_STRENGTH],
    ["IMAGE_WIDTH_1200", checks.IMAGE_WIDTH_1200],
    ["IMAGE_PIXELS_300K", checks.IMAGE_PIXELS_300K],
    ["IMAGE_LANDSCAPE", checks.IMAGE_LANDSCAPE],
    ["NON_CLICKBAIT", checks.NON_CLICKBAIT],
    ["ORIGINAL_VALUE", checks.ORIGINAL_VALUE],
    ["DEEP_ENOUGH", checks.DEEP_ENOUGH],
    ["TOPIC_FOCUS", checks.TOPIC_FOCUS],
    ["VISUAL_NOT_SITE_BRAND", checks.VISUAL_NOT_SITE_BRAND],
  ] as const;
  for (const [name, ok] of hard) if (!ok) failures.push(name);
  if (!checks.TIMELY_24H) warnings.push("TIMELY_24H");
  if (/illustration/i.test(article.image.alt) || /illustration/i.test(article.image.credit)) {
    warnings.push("IMAGE_IS_EDITORIAL_ILLUSTRATION");
  }

  const weighted = [
    checks.PUBLIC,
    checks.QUALITY_GATE,
    checks.SOURCE_STRENGTH,
    checks.IMAGE_WIDTH_1200,
    checks.IMAGE_PIXELS_300K,
    checks.IMAGE_LANDSCAPE,
    checks.NON_CLICKBAIT,
    checks.ORIGINAL_VALUE,
    checks.DEEP_ENOUGH,
    checks.TIMELY_24H,
    checks.TOPIC_FOCUS,
    checks.VISUAL_NOT_SITE_BRAND,
  ];
  const score = Math.round((weighted.filter(Boolean).length / weighted.length) * 100);
  const hardPass = failures.length === 0;
  const verdict: DiscoverLaunchpadVerdict = !hardPass ? "FAIL" : !checks.TIMELY_24H ? "REVIEW" : score >= 90 ? "PASS" : "REVIEW";

  return {
    articleId: article.id,
    slug: article.slug,
    verdict,
    hardPass,
    score,
    publishedAt: article.publishedAt,
    ageHours,
    newsSitemapEligible: ageHours != null && ageHours <= 48,
    checks,
    warnings,
    failures,
  };
}

export function recentDiscoverCandidates(
  articles: EditorialArticle[],
  now = new Date(),
  maxAgeHours = 48,
): EditorialArticle[] {
  const nowMs = now.getTime();
  return articles
    .filter(isPublicArticle)
    .filter((article) => {
      const age = finiteAgeHours(article.publishedAt, nowMs);
      return age != null && age <= maxAgeHours;
    })
    .sort((a, b) => String(b.publishedAt ?? "").localeCompare(String(a.publishedAt ?? "")));
}
