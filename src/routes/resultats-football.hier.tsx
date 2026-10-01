import { createFileRoute } from "@tanstack/react-router";
import { ResultsBoard, resultsLead } from "@/components/results-board";
import { breadcrumbJsonLd } from "@/lib/cocon";
import { ld } from "@/lib/ld";
import { collectionJsonLd, itemListJsonLd } from "@/lib/programmatic";
import { SITE_URL } from "@/lib/seo";
import { bucketResults } from "@/lib/serp/results";
import { getResultsBoard } from "@/lib/serp/results.functions";

const TITLE = "Résultats football hier";
const URL = `${SITE_URL}/resultats-football/hier`;

function pageDescription(n: number) {
  return n
    ? `Résultats football d’hier : ${n} score${n > 1 ? "s" : ""} final${n > 1 ? "aux" : ""}, avec équipes, compétitions et fiches des matchs terminés suivis par BetGPT.`
    : "Résultats football d’hier : aucun match terminé n’est disponible dans les compétitions suivies par BetGPT.";
}

export const Route = createFileRoute("/resultats-football/hier")({
  loader: () => getResultsBoard(),
  head: ({ loaderData }) => {
    const n = loaderData ? bucketResults(loaderData.rows).yesterday.length : 0;
    const description = pageDescription(n);
    return {
      meta: [
        { title: "Résultats football hier : scores finaux des matchs | BetGPT" },
        { name: "description", content: description },
        { name: "robots", content: n ? "index, follow, max-snippet:-1, max-image-preview:large" : "noindex, follow" },
        { property: "og:title", content: `${TITLE} | BetGPT` },
        { property: "og:description", content: description },
        { property: "og:url", content: URL },
        { property: "og:type", content: "website" },
      ],
      links: [{ rel: "canonical", href: URL }],
    };
  },
  component: YesterdayResults,
});

function YesterdayResults() {
  const data = Route.useLoaderData();
  const rows = bucketResults(data.rows).yesterday;
  const description = pageDescription(rows.length);
  const list = rows.slice(0, 50).map((row) => ({
    name: `${row.home} ${row.scoreHome}–${row.scoreAway} ${row.away} — ${row.competition}`,
    url: `${SITE_URL}/match/${row.slug}`,
  }));
  const structuredData = [
    collectionJsonLd(TITLE, URL, description),
    breadcrumbJsonLd([
      { name: "BetGPT", href: "/" },
      { name: "Résultats football", href: "/resultats-football" },
      { name: "Hier", href: "/resultats-football/hier" },
    ]),
    ...(list.length ? [itemListJsonLd("Résultats football hier", URL, list)] : []),
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld(structuredData) }} />
      <ResultsBoard
        h1={TITLE}
        lead={resultsLead(rows, "hier")}
        sections={[{ id: "yesterday", title: "Hier", rows }]}
        asOf={data.asOf}
      />
    </>
  );
}
