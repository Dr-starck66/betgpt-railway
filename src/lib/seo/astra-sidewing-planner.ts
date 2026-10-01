import {
  recommendedLinkBudget,
  type AstraAuditResult,
  type AstraLinkFamily,
  type AstraSide,
} from "./astra-sidewing-auditor.ts";

export type AstraLinkCandidate = {
  href: string;
  label: string;
  family: AstraLinkFamily;
  description?: string;
  topicalRelevance: number;
  businessValue?: number;
  freshness?: number;
  indexable: boolean;
  selfCanonical: boolean;
  alreadyLinked?: boolean;
  entitySpecific?: boolean;
  freshnessVerified?: boolean;
};

export type AstraPlannedLink = AstraLinkCandidate & {
  side: AstraSide;
  score: number;
};

export type AstraRejectedLink = {
  href: string;
  label: string;
  reason: string;
};

export type AstraSidewingPlan = {
  budget: number;
  left: AstraPlannedLink[];
  right: AstraPlannedLink[];
  rejected: AstraRejectedLink[];
};

const bounded = (n: number) => Math.max(0, Math.min(1, n));

export function planSidewingLinks(
  audit: AstraAuditResult,
  currentPath: string,
  candidates: AstraLinkCandidate[],
): AstraSidewingPlan {
  const budget = recommendedLinkBudget(audit);
  if (!budget || audit.verdict === "SKIP") {
    return {
      budget: 0,
      left: [],
      right: [],
      rejected: candidates.map((candidate) => ({
        href: candidate.href,
        label: candidate.label,
        reason: "Audit verdict does not authorize Sidewing links.",
      })),
    };
  }

  const familyPlan = new Map(audit.families.map((row) => [row.family, row]));
  const rejected: AstraRejectedLink[] = [];
  const deduped = new Map<string, AstraPlannedLink>();

  for (const candidate of candidates) {
    const href = candidate.href.trim();
    const label = candidate.label.trim();
    const recommendation = familyPlan.get(candidate.family);

    if (!href.startsWith("/")) {
      rejected.push({ href, label, reason: "External or non-root-relative URL." });
      continue;
    }
    if (href === currentPath) {
      rejected.push({ href, label, reason: "Self-link." });
      continue;
    }
    if (!candidate.indexable || !candidate.selfCanonical) {
      rejected.push({ href, label, reason: "Target is not an indexable self-canonical destination." });
      continue;
    }
    if (!recommendation) {
      rejected.push({ href, label, reason: "Link family is not recommended by the page audit." });
      continue;
    }
    if (candidate.family === "freshness_live" && !candidate.freshnessVerified) {
      rejected.push({ href, label, reason: "Freshness/live candidate is not verified current." });
      continue;
    }

    const score = Math.round(
      bounded(candidate.topicalRelevance) * 55 +
      bounded(candidate.businessValue ?? 0) * 12 +
      bounded(candidate.freshness ?? 0) * 8 +
      (candidate.entitySpecific ? 8 : 0) +
      (recommendation.priority === 1 ? 12 : recommendation.priority === 2 ? 6 : 2) -
      (candidate.alreadyLinked ? 18 : 0),
    );

    const planned: AstraPlannedLink = {
      ...candidate,
      href,
      label,
      side: recommendation.side,
      score,
    };

    const previous = deduped.get(href);
    if (!previous || planned.score > previous.score) deduped.set(href, planned);
  }

  const familyCounts = new Map<AstraLinkFamily, number>();
  const selected: AstraPlannedLink[] = [];

  for (const candidate of [...deduped.values()].sort((a, b) => b.score - a.score || a.href.localeCompare(b.href))) {
    if (selected.length >= budget) break;
    const recommendation = familyPlan.get(candidate.family);
    if (!recommendation) continue;
    const used = familyCounts.get(candidate.family) ?? 0;
    if (used >= recommendation.maxLinks) {
      rejected.push({
        href: candidate.href,
        label: candidate.label,
        reason: `Family budget reached for ${candidate.family}.`,
      });
      continue;
    }
    selected.push(candidate);
    familyCounts.set(candidate.family, used + 1);
  }

  const selectedHrefs = new Set(selected.map((item) => item.href));
  for (const candidate of deduped.values()) {
    if (!selectedHrefs.has(candidate.href) && !rejected.some((row) => row.href === candidate.href)) {
      rejected.push({ href: candidate.href, label: candidate.label, reason: "Global link budget reached." });
    }
  }

  return {
    budget,
    left: selected.filter((item) => item.side === "left"),
    right: selected.filter((item) => item.side === "right"),
    rejected,
  };
}
