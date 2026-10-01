import assert from "node:assert/strict";
import test from "node:test";
import { auditSidewingOpportunity } from "./astra-sidewing-auditor.ts";
import { planSidewingLinks } from "./astra-sidewing-planner.ts";

test("planner selects only safe, recommended, deduplicated internal targets", () => {
  const audit = auditSidewingOpportunity({
    pageKind: "match",
    searchIntent: "transactional",
    viewportWidth: 1440,
    primaryContentWidth: 760,
    contentWordCount: 1200,
    headingCount: 6,
    contextualInternalLinks: 2,
    uniqueInternalTargets: 2,
    relatedModules: 0,
    entityCount: 4,
    pageDepth: 3,
    hasBreadcrumbs: false,
    hasStructuredData: true,
    hasMobileLinkParity: true,
    indexable: true,
    selfCanonical: true,
    hasVisibleTrustSignals: false,
  });

  const plan = planSidewingLinks(audit, "/match/a-b", [
    { href: "/equipe/a", label: "Équipe A", family: "entity_links", topicalRelevance: 1, indexable: true, selfCanonical: true, entitySpecific: true },
    { href: "/equipe/a", label: "A", family: "entity_links", topicalRelevance: 0.4, indexable: true, selfCanonical: true },
    { href: "https://example.com", label: "External", family: "related_content", topicalRelevance: 1, indexable: true, selfCanonical: true },
    { href: "/hidden", label: "Hidden", family: "related_content", topicalRelevance: 1, indexable: false, selfCanonical: true },
    { href: "/scores-en-direct", label: "Scores live", family: "freshness_live", topicalRelevance: 0.9, freshness: 1, freshnessVerified: true, indexable: true, selfCanonical: true },
  ]);

  assert.ok(plan.left.some((link) => link.href === "/equipe/a"));
  assert.equal(plan.left.filter((link) => link.href === "/equipe/a").length, 1);
  assert.ok([...plan.left, ...plan.right].some((link) => link.href === "/scores-en-direct"));
  assert.ok(plan.rejected.some((link) => link.href === "https://example.com"));
  assert.ok(plan.rejected.some((link) => link.href === "/hidden"));
});

test("planner rejects unverified freshness links", () => {
  const audit = auditSidewingOpportunity({
    pageKind: "news",
    searchIntent: "informational",
    viewportWidth: 1440,
    primaryContentWidth: 760,
    contentWordCount: 900,
    headingCount: 4,
    contextualInternalLinks: 2,
    uniqueInternalTargets: 2,
    relatedModules: 0,
    entityCount: 2,
    pageDepth: 2,
    hasBreadcrumbs: false,
    hasStructuredData: true,
    hasMobileLinkParity: true,
    indexable: true,
    selfCanonical: true,
    staleContentRisk: true,
  });

  const plan = planSidewingLinks(audit, "/actualites/a", [
    { href: "/scores-en-direct", label: "Live", family: "freshness_live", topicalRelevance: 1, indexable: true, selfCanonical: true, freshnessVerified: false },
  ]);
  assert.equal(plan.left.length + plan.right.length, 0);
  assert.equal(plan.rejected[0]?.reason, "Freshness/live candidate is not verified current.");
});
