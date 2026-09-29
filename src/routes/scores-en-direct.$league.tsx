import { createFileRoute, notFound } from "@tanstack/react-router";
import { ScoresHub } from "@/components/scores-hub";
import { getLeagueDesk } from "@/lib/desk.functions";
import { SITE_URL } from "@/lib/seo";
import { competitionBySlug } from "@/lib/serp/leagues";

export const Route = createFileRoute("/scores-en-direct/$league")({
  loader: async ({ params }) => {
    const comp = competitionBySlug(params.league);
    if (!comp) throw notFound();
    const data = await getLeagueDesk({ data: { league: comp.league } });
    return { ...data, comp };
  },
  head: ({ loaderData, params }) => {
    const comp = loaderData?.comp ?? competitionBySlug(params.league);
    if (!comp) return { meta: [{ title: "Scores | BetGPT" }, { name: "robots", content: "noindex, follow" }] };
    const n = loaderData?.matches.length ?? 0;
    const url = `${SITE_URL}${comp.scoresPath}`;
    return {
      meta: [
        { title: `Scores en direct ${comp.title} | BetGPT` },
        {
          name: "description",
          content:
            n > 0
              ? `Scores ${comp.title} : matchs en direct, à venir et résultats du jour présents dans le bureau BetGPT.`
              : `Aucun match ${comp.title} n’est dans le bureau BetGPT pour le moment.`,
        },
        { name: "robots", content: n > 0 ? "index, follow, max-snippet:-1" : "noindex, follow" },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: LeagueScores,
});

function LeagueScores() {
  const data = Route.useLoaderData();
  const live = data.matches.filter((m) => m.status === "live").length;
  return (
    <ScoresHub
      title={`Scores en direct ${data.comp.title}`}
      lead={
        data.matches.length
          ? live
            ? `${live} match${live > 1 ? "s" : ""} ${data.comp.title} en cours.`
            : `Matchs ${data.comp.title} du bureau : à venir ou déjà terminés aujourd’hui.`
          : `Aucun match ${data.comp.title} n’est dans le bureau en ce moment.`
      }
      data={data}
      path={data.comp.scoresPath}
    />
  );
}
