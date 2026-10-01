import { createFileRoute } from "@tanstack/react-router";
import { ResultsBoard, dayTitle, resultsLead } from "@/components/results-board";
import { SITE_URL } from "@/lib/seo";
import { recentResultDays } from "@/lib/serp/results";
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
  const days = recentResultDays(data.rows, Date.now(), 7);
  const today = days[0]?.rows ?? [];
  const lead = resultsLead(today.length ? today : data.rows, today.length ? "aujourd’hui" : "récents");
  const sections = days.map(({ day, rows }, index) => ({
    id: day,
    title: index === 0 ? "Aujourd’hui" : index === 1 ? "Hier" : dayTitle(day),
    rows,
  }));
  return <ResultsBoard h1="Résultats football" lead={lead} sections={sections} asOf={data.asOf} />;
}
