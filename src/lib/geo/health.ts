import { editorialChangelog } from "@/lib/geo/changelog";
import { GEO_PAGES, geoCanonical } from "@/lib/geo/entity";
import { citationReadiness } from "@/lib/geo/readiness";
import { crawlerProof } from "@/lib/geo/robots-audit";
import { geoJsonLd, validateJsonLd } from "@/lib/geo/schema";
import { sitemapAllowed } from "@/lib/geo/quality";

export type HealthStatus = "PASS" | "PARTIAL" | "WARN" | "FAIL" | "UNVERIFIED";

export type HealthRow = {
  id: string;
  status: HealthStatus;
  detail: string;
};

function docBody(path: string): string {
  const doc = GEO_PAGES.find((p) => p.path === path);
  if (!doc) return "";
  return [doc.answer, ...doc.sections.flatMap((s) => [s.h2, ...s.paragraphs, ...(s.items ?? [])])].join("\n");
}

export function geoHealth(): HealthRow[] {
  const proofs = crawlerProof();
  const robotsOk = proofs.every((p) => p.importantOpen && p.privateClosed);
  const schemaChecks = GEO_PAGES.map((doc) => validateJsonLd(geoJsonLd(doc)));
  const schemaOk = schemaChecks.every((c) => c.ok);
  const readiness = GEO_PAGES.filter((p) => p.indexable).map((doc) =>
    citationReadiness({
      title: doc.title,
      description: doc.description,
      h1: doc.h1,
      canonical: geoCanonical(doc.path),
      updated: doc.updated,
      body: docBody(doc.path),
      jsonLd: true,
      indexable: doc.indexable,
      internalLinks: doc.links.length,
      hasSourceNote: /ESPN|modèle|échantillon|manquante|n’est pas|n'est pas/i.test(docBody(doc.path) + doc.answer),
    }),
  );
  const thin = readiness.filter((r) => r.score < 80);
  const blocked = GEO_PAGES.filter((p) => p.indexable && !sitemapAllowed(p.path));
  const changelog = editorialChangelog();
  return [
    {
      id: "Robots",
      status: robotsOk ? "PASS" : "FAIL",
      detail: proofs.map((p) => `${p.agent}:${p.importantOpen && p.privateClosed ? "ok" : "ko"}`).join(" "),
    },
    {
      id: "Sitemap",
      status: blocked.length ? "FAIL" : "PASS",
      detail: blocked.length ? `pages bloquées à tort: ${blocked.map((p) => p.path).join(",")}` : "pages d’entité autorisées dans le filtre sitemap",
    },
    {
      id: "Canonical",
      status: GEO_PAGES.every((p) => geoCanonical(p.path).startsWith("https://betgpt.live")) ? "PASS" : "FAIL",
      detail: "canonical https://betgpt.live + chemin",
    },
    {
      id: "Schema",
      status: schemaOk ? "PASS" : "FAIL",
      detail: schemaOk ? `${schemaChecks.length} JSON-LD valides` : "JSON-LD invalide",
    },
    {
      id: "Indexability",
      status: GEO_PAGES.filter((p) => p.indexable).length >= 6 ? "PASS" : "WARN",
      detail: `${GEO_PAGES.filter((p) => p.indexable).length} pages d’entité indexables`,
    },
    {
      id: "Citation readiness",
      status: thin.length ? "WARN" : "PASS",
      detail: readiness.map((r, i) => `${GEO_PAGES[i]?.path} ${r.score}`).join(" "),
    },
    {
      id: "Evidence",
      status: "PARTIAL",
      detail: "Registre existant (/ledger, tickets). Cette couche ne recalcule pas un ROI.",
    },
    {
      id: "AI monitor",
      status: "PARTIAL",
      detail: "Liste de requêtes prête. Aucune mention moteur n’est observée tant qu’un humain ne l’enregistre.",
    },
    {
      id: "Changelog",
      status: changelog.every((c) => c.modified === "2026-09-23") ? "PASS" : "WARN",
      detail: `${changelog.length} pages, révision ${changelog[0]?.modified ?? "UNKNOWN"}`,
    },
    {
      id: "HTTP live",
      status: "UNVERIFIED",
      detail: "Le statut HTTP du domaine public n’est pas prouvé par ce calcul local.",
    },
  ];
}
