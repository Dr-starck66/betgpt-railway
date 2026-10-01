export type AstraPageKind =
  | "article"
  | "guide"
  | "entity"
  | "match"
  | "result"
  | "comparison"
  | "hub"
  | "tool"
  | "news"
  | "landing"
  | "other";

export type AstraSearchIntent =
  | "informational"
  | "transactional"
  | "commercial"
  | "comparative"
  | "navigational"
  | "mixed";

export type AstraLinkFamily =
  | "parent_silo"
  | "sibling_pages"
  | "entity_links"
  | "related_content"
  | "comparison"
  | "trust_proof"
  | "next_step"
  | "freshness_live";

export type AstraSide = "left" | "right";

export type AstraAuditInput = {
  pageKind: AstraPageKind;
  searchIntent: AstraSearchIntent;
  viewportWidth: number;
  primaryContentWidth: number;
  contentWordCount: number;
  headingCount: number;
  contextualInternalLinks: number;
  uniqueInternalTargets: number;
  relatedModules: number;
  entityCount: number;
  pageDepth: number;
  hasBreadcrumbs: boolean;
  hasStructuredData: boolean;
  hasMobileLinkParity: boolean;
  indexable: boolean;
  selfCanonical: boolean;
  isRedirect?: boolean;
  duplicateLinkRatio?: number;
  thinContentRisk?: boolean;
  staleContentRisk?: boolean;
  hasVisibleTrustSignals?: boolean;
};

export type AstraFamilyRecommendation = {
  family: AstraLinkFamily;
  side: AstraSide;
  priority: 1 | 2 | 3;
  maxLinks: number;
  reason: string;
};

export type AstraAuditVerdict = "PRIORITY" | "RECOMMENDED" | "OPTIONAL" | "SKIP";

export type AstraAuditResult = {
  version: "ASTRA-SIDEWING-AUDITOR-1";
  verdict: AstraAuditVerdict;
  sidewingNeed: number;
  seoOpportunity: number;
  confidence: number;
  whitespaceRatio: number;
  families: AstraFamilyRecommendation[];
  reasons: string[];
  seoRisks: string[];
  safeguards: string[];
};

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function family(
  family: AstraLinkFamily,
  side: AstraSide,
  priority: 1 | 2 | 3,
  maxLinks: number,
  reason: string,
): AstraFamilyRecommendation {
  return { family, side, priority, maxLinks, reason };
}

function dedupeFamilies(rows: AstraFamilyRecommendation[]): AstraFamilyRecommendation[] {
  const seen = new Set<AstraLinkFamily>();
  return rows.filter((row) => {
    if (seen.has(row.family)) return false;
    seen.add(row.family);
    return true;
  });
}

export function auditSidewingOpportunity(input: AstraAuditInput): AstraAuditResult {
  const reasons: string[] = [];
  const seoRisks: string[] = [];
  const safeguards = [
    "Use only real, crawlable internal URLs with descriptive anchors.",
    "Keep the same internal links on mobile and desktop.",
    "Do not add structured data for content that is not visibly present.",
    "Do not create doorway-like link clouds or duplicate near-identical modules.",
    "Cap each link family and deduplicate targets before rendering.",
  ];

  const safeViewport = Math.max(1, input.viewportWidth);
  const safeContent = Math.max(1, input.primaryContentWidth);
  const whitespaceRatio = Math.max(0, Math.min(1, 1 - safeContent / safeViewport));
  const duplicateLinkRatio = Math.max(0, Math.min(1, input.duplicateLinkRatio ?? 0));

  if (input.isRedirect) {
    return {
      version: "ASTRA-SIDEWING-AUDITOR-1",
      verdict: "SKIP",
      sidewingNeed: 0,
      seoOpportunity: 0,
      confidence: 100,
      whitespaceRatio,
      families: [],
      reasons: ["Redirect pages should consolidate signals into the canonical destination instead of receiving Sidewings."],
      seoRisks: ["Adding content to a redirect route creates maintenance noise without strengthening the canonical page."],
      safeguards,
    };
  }

  let need = 0;
  let seo = 0;
  let confidence = 100;

  if (input.viewportWidth >= 1200 && whitespaceRatio >= 0.42) {
    need += 36;
    reasons.push("Large desktop whitespace surrounds the primary content.");
  } else if (input.viewportWidth >= 1024 && whitespaceRatio >= 0.32) {
    need += 24;
    reasons.push("Material desktop whitespace can support contextual rails.");
  } else if (input.viewportWidth < 900) {
    need -= 20;
    reasons.push("Narrow viewport: Sidewings should reflow below the primary content rather than remain lateral.");
  }

  if (input.primaryContentWidth <= 820 && input.viewportWidth >= 1280) need += 14;

  if (input.relatedModules === 0) {
    need += 14;
    seo += 10;
    reasons.push("No visible related-content or next-step module exists.");
  }

  if (input.contextualInternalLinks < 4) {
    need += 10;
    seo += 24;
    reasons.push("Contextual internal-link density is low.");
  } else if (input.contextualInternalLinks < 8) {
    seo += 12;
  }

  if (input.uniqueInternalTargets < Math.max(3, Math.ceil(input.contextualInternalLinks * 0.65))) {
    seo += 8;
    seoRisks.push("Existing links may over-repeat the same destinations instead of expanding crawl paths.");
  }

  if (!input.hasBreadcrumbs && input.pageDepth >= 2) {
    seo += 14;
    reasons.push("A deeper page lacks breadcrumb context.");
  }

  if (!input.hasMobileLinkParity) {
    seo += 18;
    seoRisks.push("Internal-link parity between mobile and desktop is missing.");
  }

  if (!input.hasStructuredData && ["article", "news", "entity", "match", "guide"].includes(input.pageKind)) {
    seo += 8;
    reasons.push("Eligible content type has no declared structured-data support.");
  }

  if (input.entityCount >= 2) {
    seo += 10;
    reasons.push("The page exposes multiple real entities that can power contextual internal links.");
  }

  if (input.pageDepth >= 3) seo += 8;
  if (input.contentWordCount >= 700 && input.headingCount >= 3) seo += 8;

  if (input.thinContentRisk) {
    seo -= 18;
    seoRisks.push("Thin-content risk: strengthen the main content before using Sidewings as an SEO amplifier.");
  }

  if (input.staleContentRisk) {
    seo += 8;
    seoRisks.push("Freshness risk detected: prefer live/freshness links only when their data is actually current.");
  }

  if (!input.indexable) {
    seo = Math.min(seo, 20);
    seoRisks.push("Page is not indexable; Sidewings can help UX but have limited direct indexing value.");
  }

  if (!input.selfCanonical) {
    seo = Math.min(seo, 10);
    seoRisks.push("Page is not self-canonical; strengthen the canonical target instead.");
  }

  if (duplicateLinkRatio > 0.45) {
    seo -= 14;
    seoRisks.push("High duplicate-link ratio: adding more links could worsen boilerplate saturation.");
  }

  if (duplicateLinkRatio > 0.7) confidence -= 15;
  if (input.contentWordCount < 120) confidence -= 10;

  need = clamp(need);
  seo = clamp(seo);
  confidence = clamp(confidence);

  const rows: AstraFamilyRecommendation[] = [];

  if (input.pageDepth >= 2 || !input.hasBreadcrumbs) {
    rows.push(family("parent_silo", "left", 1, 2, "Reinforce the page's parent topic and shorten the route back to the main hub."));
  }

  if (["article", "guide", "news", "match", "entity"].includes(input.pageKind)) {
    rows.push(family("sibling_pages", "left", 1, 4, "Expose closely related pages at the same semantic level."));
  }

  if (input.entityCount >= 2 || ["match", "entity", "result"].includes(input.pageKind)) {
    rows.push(family("entity_links", "left", 1, 4, "Connect named entities to their dedicated pages instead of generic hubs."));
  }

  if (["article", "guide", "news"].includes(input.pageKind) || input.relatedModules === 0) {
    rows.push(family("related_content", "right", 1, 4, "Add a genuinely related reading path based on topic overlap."));
  }

  if (["comparison", "match", "result"].includes(input.pageKind) || ["commercial", "comparative"].includes(input.searchIntent)) {
    rows.push(family("comparison", "right", 1, 3, "Serve comparison intent with relevant alternatives, prices or side-by-side pages."));
  }

  if (!input.hasVisibleTrustSignals || ["article", "guide", "news", "match"].includes(input.pageKind)) {
    rows.push(family("trust_proof", "right", 2, 3, "Surface methodology, sources, authorship or public evidence without inventing ratings."));
  }

  if (["transactional", "commercial", "comparative", "mixed"].includes(input.searchIntent)) {
    rows.push(family("next_step", "right", 2, 3, "Offer the logical next action without distracting from the primary content."));
  }

  if (input.staleContentRisk || ["news", "result", "match"].includes(input.pageKind)) {
    rows.push(family("freshness_live", "right", 2, 2, "Expose current/live destinations only when freshness can be verified."));
  }

  const families = dedupeFamilies(rows)
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 6);

  const blended = need * 0.56 + seo * 0.44;
  let verdict: AstraAuditVerdict =
    blended >= 64 && need >= 45 && seo >= 35
      ? "PRIORITY"
      : blended >= 45 && (need >= 35 || seo >= 45)
        ? "RECOMMENDED"
        : blended >= 24
          ? "OPTIONAL"
          : "SKIP";

  if (!input.selfCanonical) verdict = "SKIP";
  if (!input.indexable && verdict === "PRIORITY") verdict = "RECOMMENDED";

  return {
    version: "ASTRA-SIDEWING-AUDITOR-1",
    verdict,
    sidewingNeed: need,
    seoOpportunity: seo,
    confidence,
    whitespaceRatio: Number(whitespaceRatio.toFixed(3)),
    families: verdict === "SKIP" ? [] : families,
    reasons,
    seoRisks,
    safeguards,
  };
}

export function recommendedLinkBudget(result: AstraAuditResult): number {
  if (result.verdict === "SKIP") return 0;
  const requested = result.families.reduce((sum, row) => sum + row.maxLinks, 0);
  const cap = result.verdict === "PRIORITY" ? 14 : result.verdict === "RECOMMENDED" ? 10 : 6;
  return Math.min(requested, cap);
}
