import { SITE_URL } from "@/lib/programmatic";
import type { GeoDoc } from "@/lib/geo/entity";

export function validateJsonLd(value: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(JSON.stringify(value));
  } catch {
    return { ok: false, errors: ["JSON-LD non sérialisable"] };
  }
  if (!parsed || typeof parsed !== "object") return { ok: false, errors: ["JSON-LD vide"] };
  const root = parsed as Record<string, unknown>;
  if (root["@context"] !== "https://schema.org") errors.push("@context manquant");
  const nodes = Array.isArray(root["@graph"]) ? root["@graph"] : [root];
  if (!nodes.length) errors.push("aucun nœud");
  for (const node of nodes) {
    if (!node || typeof node !== "object" || !("@type" in node)) errors.push("nœud sans @type");
  }
  return { ok: errors.length === 0, errors };
}

export function geoJsonLd(doc: GeoDoc): object {
  const url = `${SITE_URL}${doc.path}`;
  const orgId = `${SITE_URL}/#org`;
  const graph: object[] = [
    {
      "@type": doc.path === "/about" ? "AboutPage" : "WebPage",
      "@id": `${url}#webpage`,
      url,
      name: doc.h1,
      description: doc.answer,
      dateModified: doc.updated,
      inLanguage: "fr-FR",
      isPartOf: { "@id": `${SITE_URL}/#website` },
      publisher: { "@id": orgId },
      primaryImageOfPage: `${SITE_URL}/logo-betgpt-pronostics-football.png`,
    },
    {
      "@type": "BreadcrumbList",
      "@id": `${url}#breadcrumb`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "BetGPT", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: doc.h1, item: url },
      ],
    },
  ];
  return { "@context": "https://schema.org", "@graph": graph };
}
