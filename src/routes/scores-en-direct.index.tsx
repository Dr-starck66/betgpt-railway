import { createFileRoute } from "@tanstack/react-router";
import { ScoresHub } from "@/components/scores-hub";
import { getPublicDesk } from "@/lib/desk.functions";
import { SITE_URL } from "@/lib/seo";

const H1 = "Scores en direct : matchs et résultats football";

export const Route = createFileRoute("/scores-en-direct/")({
  loader: () => getPublicDesk(),
  head: () => ({
    meta: [
      { title: "Scores en direct : matchs et résultats football | BetGPT" },
      {
        name: "description",
        content:
          "Scores en direct de football : matchs en cours, minute, statut et résultats. Ligue 1, Premier League, Liga, Bundesliga, Serie A, Ligue des champions.",
      },
      { name: "robots", content: "index, follow, max-snippet:-1, max-image-preview:large" },
      { property: "og:title", content: "Scores en direct football | BetGPT" },
      { property: "og:url", content: `${SITE_URL}/scores-en-direct` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/scores-en-direct` }],
  }),
  component: () => {
    const data = Route.useLoaderData();
    const n = data.matches.filter((m) => m.status === "live").length;
    return (
      <ScoresHub
        title={H1}
        lead={
          n > 0
            ? `${n} match${n > 1 ? "s" : ""} en cours dans le bureau.`
            : "Aucun match n’est en direct dans le bureau BetGPT pour le moment. Les rencontres à venir et les résultats du jour sont listés ci-dessous."
        }
        data={data}
        path="/scores-en-direct"
      />
    );
  },
});
