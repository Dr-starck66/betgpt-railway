import type { EditorialArticle, EditorialSource } from "@/lib/editorial/types";

const STRONG_STATUSES = new Set<EditorialSource["status"]>([
  "OFFICIAL",
  "HIGH_CONFIDENCE",
  "CORROBORATED",
]);

function hasHttpUrl(source: EditorialSource | undefined): source is EditorialSource & { url: string } {
  return Boolean(source?.url && /^https:\/\//i.test(source.url));
}

function citationRank(source: EditorialSource | undefined): number {
  if (!source) return 99;
  if (source.status === "OFFICIAL") return 0;
  if (source.status === "HIGH_CONFIDENCE") return 1;
  if (source.status === "CORROBORATED") return 2;
  if (source.status === "UNCONFIRMED") return 3;
  return 4;
}

export function orderedContextualSourceIds(
  sourceIds: string[] | undefined,
  sources: EditorialSource[],
): string[] {
  const byId = new Map(sources.map((source) => [source.id, source] as const));
  return [...new Set(sourceIds ?? [])].sort(
    (a, b) => citationRank(byId.get(a)) - citationRank(byId.get(b)),
  );
}

export function contextualAuthorityGate(
  article: Pick<EditorialArticle, "articleType" | "paragraphs" | "sources">,
): { pass: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const byId = new Map(article.sources.map((source) => [source.id, source] as const));
  const citedIds = new Set<string>();

  article.paragraphs.forEach((part, index) => {
    const ids = [...new Set(part.sourceIds ?? [])];
    if (!ids.length) {
      reasons.push(`passage ${index + 1} sans source contextuelle`);
      return;
    }

    const resolved = ids
      .map((id) => {
        citedIds.add(id);
        return byId.get(id);
      })
      .filter((source): source is EditorialSource => Boolean(source));

    if (resolved.length !== ids.length) {
      reasons.push(`passage ${index + 1} référence une source inconnue`);
    }
    if (!resolved.length) {
      reasons.push(`passage ${index + 1} sans preuve résolue`);
      return;
    }

    if (article.articleType === "news") {
      const strongExternal = resolved.filter(
        (source) => hasHttpUrl(source) && STRONG_STATUSES.has(source.status),
      );
      if (!strongExternal.length) {
        reasons.push(`passage ${index + 1} sans source externe forte`);
      }
    }
  });

  if (article.articleType === "news") {
    const cited = [...citedIds]
      .map((id) => byId.get(id))
      .filter((source): source is EditorialSource => Boolean(source));

    const citedStrongExternal = cited.filter(
      (source) => hasHttpUrl(source) && STRONG_STATUSES.has(source.status),
    );
    const citedOfficial = citedStrongExternal.filter((source) => source.status === "OFFICIAL");
    const availableOfficial = article.sources.filter(
      (source) => hasHttpUrl(source) && source.status === "OFFICIAL",
    );

    if (availableOfficial.length && !citedOfficial.length) {
      reasons.push("source officielle disponible mais jamais citée dans le corps");
    }

    const distinctStrongExternal = new Set(citedStrongExternal.map((source) => source.id));
    if (!citedOfficial.length && distinctStrongExternal.size < 2) {
      reasons.push("actualité sans source officielle : au moins deux sources externes fortes distinctes sont requises");
    }
  }

  return { pass: reasons.length === 0, reasons };
}
