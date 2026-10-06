import { createFileRoute } from "@tanstack/react-router";
import { ResultsBoard, resultsLead } from "@/components/results-board";
import { breadcrumbJsonLd } from "@/lib/cocon";
import { ld } from "@/lib/ld";
import { collectionJsonLd, itemListJsonLd } from "@/lib/programmatic";
import { SITE_URL } from "@/lib/seo";
import { bucketResults } from "@/lib/serp/results";
import { getResultsBoard } from "@/lib/serp/results.functions";

const TITLE = "Résultats football aujourd’hui";
const URL = `${SITE_URL}/resultats-football/aujourdhui`;

function pageDescription(n: number) {
  return n
    ? `Résultats football aujourd’hui : ${n} score${n > 1 ? "s" : ""} final${n > 1 ? "aux" : ""}, avec heures, équipes et compétitions des matchs terminés suivis par BetGPT.`
    : "Résultats football aujourd’hui : aucun match terminé n’est encore disponible dans les compétitions suivies par BetGPT.";
}

export const Route = createFileRoute("/resultats-football/aujourdhui")({
  loader: () => getResultsBoard(),
  head: ({ loaderData }) => {
    const dayRows = loaderData ? bucketResults(loaderData.rows).today : [];
    const n = dayRows.length;
    const durableN = dayRows.filter((row) => row.detailAvailable).length;
    const description = pageDescription(n);
    return {
      meta: [
        { title: "Résultats football aujourd’hui : scores finaux du jour | BetGPT" },
        { name: "description", content: description },
        { name: "robots", content: durableN ? "index, follow, max-snippet:-1, max-image-preview:large" : "noindex, follow" },
        { property: "og:title", content: `${TITLE} | BetGPT` },
        { property: "og:description", content: description },
        { property: "og:url", content: URL },
        { property: "og:type", content: "website" },
      ],
      links: [{ rel: "canonical", href: URL }],
    };
  },
  component: TodayResults,
});

function TodayResults() {
  const data = Route.useLoaderData();
  const rows = bucketResults(data.rows).today;
  const description = pageDescription(rows.length);
  const list = rows.filter((row) => row.detailAvailable).slice(0, 50).map((row) => ({
    name: `${row.home} ${row.scoreHome}–${row.scoreAway} ${row.away} — ${row.competition}`,
    url: `${SITE_URL}/match/${row.slug}`,
  }));
  const structuredData = [
    collectionJsonLd(TITLE, URL, description),
    breadcrumbJsonLd([
      { name: "BetGPT", href: "/" },
      { name: "Résultats football", href: "/resultats-football" },
      { name: "Aujourd’hui", href: "/resultats-football/aujourdhui" },
    ]),
    ...(list.length ? [itemListJsonLd("Résultats football aujourd’hui", URL, list)] : []),
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld(structuredData) }} />
      <ResultsBoard
        h1={TITLE}
        lead={resultsLead(rows, "aujourd’hui")}
        sections={[{ id: "today", title: "Aujourd’hui", rows }]}
        asOf={data.asOf}
      />
    </>
  );
}
