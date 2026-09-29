import { createFileRoute } from "@tanstack/react-router";
import { ResultsBoard, dayTitle, resultsLead } from "@/components/results-board";
import { SITE_URL } from "@/lib/seo";
import { bucketResults } from "@/lib/serp/results";
import { getResultsBoard } from "@/lib/serp/results.functions";

export const Route = createFileRoute("/resultats-football/")({
  loader: () => getResultsBoard(),
  head: () => ({
    meta: [
      { title: "Résultats football : matchs terminés | BetGPT" },
      {
        name: "description",
        content: "Résultats football du jour, d’hier et de la veille : score final, match et compétition. Données du bureau BetGPT, sans score inventé.",
      },
      { name: "robots", content: "index, follow, max-snippet:-1, max-image-preview:large" },
      { property: "og:url", content: `${SITE_URL}/resultats-football` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/resultats-football` }],
  }),
  component: ResultsHome,
});

function ResultsHome() {
  const data = Route.useLoaderData();
  const buckets = bucketResults(data.rows);
  const lead = resultsLead(buckets.today.length ? buckets.today : data.rows, buckets.today.length ? "aujourd’hui" : "récents");
  return (
    <ResultsBoard
      h1="Résultats football"
      lead={lead}
      sections={[
        { id: "today", title: "Aujourd’hui", rows: buckets.today },
        { id: "yesterday", title: "Hier", rows: buckets.yesterday },
        { id: "previous", title: buckets.previousDay ? dayTitle(buckets.previousDay) : "Date précédente", rows: buckets.previous },
      ]}
    />
  );
}
