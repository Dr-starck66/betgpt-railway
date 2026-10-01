import type {
  EditorialArticle,
  EditorialParagraph,
  EditorialSource,
} from "@/lib/editorial/types";

const STRONG_STATUSES = new Set<EditorialSource["status"]>([
  "OFFICIAL",
  "HIGH_CONFIDENCE",
  "CORROBORATED",
]);

type CitationBlock = {
  label: string;
  sourceIds?: string[];
};

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

function citationBlocks(paragraphs: EditorialParagraph[]): CitationBlock[] {
  const blocks: CitationBlock[] = [];

  for (const paragraph of paragraphs) {
    blocks.push({ label: `H2 « ${paragraph.h2} »`, sourceIds: paragraph.sourceIds });

    for (const subsection of paragraph.subsections ?? []) {
      blocks.push({ label: `H3 « ${subsection.h3} »`, sourceIds: subsection.sourceIds });

      for (const detail of subsection.subsections ?? []) {
        blocks.push({ label: `H4 « ${detail.h4} »`, sourceIds: detail.sourceIds });
      }
    }
  }

  return blocks;
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

  for (const block of citationBlocks(article.paragraphs)) {
    const ids = [...new Set(block.sourceIds ?? [])];
    if (!ids.length) {
      reasons.push(`${block.label} sans source contextuelle`);
      continue;
    }

    const resolved: EditorialSource[] = [];
    for (const id of ids) {
      citedIds.add(id);
      const source = byId.get(id);
      if (!source) {
        reasons.push(`${block.label} référence une source inconnue : ${id}`);
        continue;
      }
      resolved.push(source);
    }

    if (!resolved.length) {
      reasons.push(`${block.label} sans preuve résolue`);
      continue;
    }

    if (article.articleType === "news") {
      const strongExternal = resolved.filter(
        (source) => hasHttpUrl(source) && STRONG_STATUSES.has(source.status),
      );
      if (!strongExternal.length) {
        reasons.push(`${block.label} sans source externe forte`);
      }
    }
  }

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
    if (!availableOfficial.length && distinctStrongExternal.size < 2) {
      reasons.push(
        "actualité sans source officielle : au moins deux sources externes fortes distinctes sont requises",
      );
    }
  }

  const uniqueReasons = [...new Set(reasons)];
  return { pass: uniqueReasons.length === 0, reasons: uniqueReasons };
}
