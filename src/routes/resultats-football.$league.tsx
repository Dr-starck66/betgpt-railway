import { createFileRoute, notFound } from "@tanstack/react-router";
import { ResultsBoard, resultsLead } from "@/components/results-board";
import { SITE_URL } from "@/lib/seo";
import { competitionBySlug } from "@/lib/serp/leagues";
import { getResultsBoard } from "@/lib/serp/results.functions";

export const Route = createFileRoute("/resultats-football/$league")({
  loader: async ({ params }) => {
    const comp = competitionBySlug(params.league);
    if (!comp) throw notFound();
    const data = await getResultsBoard();
    return { ...data, comp, rows: data.rows.filter((row) => row.league === comp.league) };
  },
  head: ({ loaderData, params }) => {
    const comp = loaderData?.comp ?? competitionBySlug(params.league);
    if (!comp) return { meta: [{ title: "Résultats | BetGPT" }, { name: "robots", content: "noindex, follow" }] };
    const n = loaderData?.rows.length ?? 0;
    const url = `${SITE_URL}${comp.resultsPath}`;
    return {
      meta: [
        { title: `Résultats ${comp.title} | BetGPT` },
        {
          name: "description",
          content: n ? `Résultats ${comp.title} : scores finaux des matchs enregistrés.` : `Aucun résultat ${comp.title} récent dans le bureau BetGPT.`,
        },
        { name: "robots", content: n ? "index, follow, max-snippet:-1" : "noindex, follow" },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: LeagueResults,
});

function LeagueResults() {
  const data = Route.useLoaderData();
  return (
    <ResultsBoard
      h1={`Résultats ${data.comp.title}`}
      lead={resultsLead(data.rows, data.comp.title)}
      sections={[{ id: data.comp.slug, title: data.comp.title, rows: data.rows }]}
    />
  );
}
