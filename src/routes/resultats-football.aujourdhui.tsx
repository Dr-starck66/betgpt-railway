import { createFileRoute } from "@tanstack/react-router";
import { ResultsBoard, resultsLead } from "@/components/results-board";
import { SITE_URL } from "@/lib/seo";
import { bucketResults } from "@/lib/serp/results";
import { getResultsBoard } from "@/lib/serp/results.functions";

export const Route = createFileRoute("/resultats-football/aujourdhui")({
  loader: () => getResultsBoard(),
  head: ({ loaderData }) => {
    const n = loaderData ? bucketResults(loaderData.rows).today.length : 0;
    return {
      meta: [
        { title: "Résultats football aujourd’hui | BetGPT" },
        { name: "description", content: n ? `${n} résultats football enregistrés aujourd’hui.` : "Aucun résultat football aujourd’hui dans le bureau BetGPT." },
        { name: "robots", content: n ? "index, follow, max-snippet:-1" : "noindex, follow" },
        { property: "og:url", content: `${SITE_URL}/resultats-football/aujourdhui` },
      ],
      links: [{ rel: "canonical", href: `${SITE_URL}/resultats-football/aujourdhui` }],
    };
  },
  component: () => {
    const data = Route.useLoaderData();
    const rows = bucketResults(data.rows).today;
    return <ResultsBoard h1="Résultats football aujourd’hui" lead={resultsLead(rows, "aujourd’hui")} sections={[{ id: "today", title: "Aujourd’hui", rows }]} />;
  },
});
