import assert from "node:assert/strict";
import test from "node:test";
import { auditSidewingOpportunity, recommendedLinkBudget } from "./astra-sidewing-auditor";

test("flags narrow desktop article with weak internal linking as priority", () => {
  const result = auditSidewingOpportunity({
    pageKind: "article",
    searchIntent: "informational",
    viewportWidth: 1440,
    primaryContentWidth: 760,
    contentWordCount: 1500,
    headingCount: 6,
    contextualInternalLinks: 2,
    uniqueInternalTargets: 2,
    relatedModules: 0,
    entityCount: 3,
    pageDepth: 3,
    hasBreadcrumbs: false,
    hasStructuredData: true,
    hasMobileLinkParity: true,
    indexable: true,
    selfCanonical: true,
    hasVisibleTrustSignals: false,
  });

  assert.equal(result.verdict, "PRIORITY");
  assert.ok(result.sidewingNeed >= 60);
  assert.ok(result.seoOpportunity >= 55);
  assert.ok(result.families.some((row) => row.family === "parent_silo"));
  assert.ok(result.families.some((row) => row.family === "related_content"));
  assert.ok(recommendedLinkBudget(result) <= 14);
});

test("skips redirect routes", () => {
  const result = auditSidewingOpportunity({
    pageKind: "result",
    searchIntent: "navigational",
    viewportWidth: 1440,
    primaryContentWidth: 700,
    contentWordCount: 0,
    headingCount: 0,
    contextualInternalLinks: 0,
    uniqueInternalTargets: 0,
    relatedModules: 0,
    entityCount: 2,
    pageDepth: 2,
    hasBreadcrumbs: false,
    hasStructuredData: false,
    hasMobileLinkParity: false,
    indexable: false,
    selfCanonical: false,
    isRedirect: true,
  });

  assert.equal(result.verdict, "SKIP");
  assert.equal(result.families.length, 0);
  assert.equal(result.seoOpportunity, 0);
});

test("does not over-optimize a wide, well-meshed hub", () => {
  const result = auditSidewingOpportunity({
    pageKind: "hub",
    searchIntent: "mixed",
    viewportWidth: 1440,
    primaryContentWidth: 1180,
    contentWordCount: 1200,
    headingCount: 7,
    contextualInternalLinks: 18,
    uniqueInternalTargets: 17,
    relatedModules: 3,
    entityCount: 10,
    pageDepth: 1,
    hasBreadcrumbs: true,
    hasStructuredData: true,
    hasMobileLinkParity: true,
    indexable: true,
    selfCanonical: true,
    hasVisibleTrustSignals: true,
  });

  assert.ok(["OPTIONAL", "SKIP"].includes(result.verdict));
  assert.ok(result.sidewingNeed < 30);
});

test("caps direct SEO value for noindex pages while preserving UX analysis", () => {
  const result = auditSidewingOpportunity({
    pageKind: "tool",
    searchIntent: "transactional",
    viewportWidth: 1366,
    primaryContentWidth: 720,
    contentWordCount: 500,
    headingCount: 3,
    contextualInternalLinks: 1,
    uniqueInternalTargets: 1,
    relatedModules: 0,
    entityCount: 0,
    pageDepth: 2,
    hasBreadcrumbs: false,
    hasStructuredData: false,
    hasMobileLinkParity: true,
    indexable: false,
    selfCanonical: true,
  });

  assert.ok(result.sidewingNeed >= 45);
  assert.ok(result.seoOpportunity <= 20);
  assert.notEqual(result.verdict, "PRIORITY");
});
