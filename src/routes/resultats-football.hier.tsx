import { createFileRoute } from "@tanstack/react-router";
import { ResultsBoard, resultsLead } from "@/components/results-board";
import { SITE_URL } from "@/lib/seo";
import { bucketResults } from "@/lib/serp/results";
import { getResultsBoard } from "@/lib/serp/results.functions";

export const Route = createFileRoute("/resultats-football/hier")({
  loader: () => getResultsBoard(),
  head: ({ loaderData }) => {
    const n = loaderData ? bucketResults(loaderData.rows).yesterday.length : 0;
    return {
      meta: [
        { title: "Résultats football hier | BetGPT" },
        { name: "description", content: n ? `${n} résultats football enregistrés hier.` : "Aucun résultat football d’hier dans le bureau BetGPT." },
        { name: "robots", content: n ? "index, follow, max-snippet:-1" : "noindex, follow" },
        { property: "og:url", content: `${SITE_URL}/resultats-football/hier` },
      ],
      links: [{ rel: "canonical", href: `${SITE_URL}/resultats-football/hier` }],
    };
  },
  component: () => {
    const data = Route.useLoaderData();
    const rows = bucketResults(data.rows).yesterday;
    return <ResultsBoard h1="Résultats football hier" lead={resultsLead(rows, "hier")} sections={[{ id: "yesterday", title: "Hier", rows }]} />;
  },
});
