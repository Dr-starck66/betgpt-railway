import { createFileRoute } from "@tanstack/react-router";
import { CupPage } from "@/components/cup-page";
import { getLeagueDesk } from "@/lib/desk.functions";
import { SITE_URL } from "@/lib/seo";

export const Route = createFileRoute("/ligue-des-champions")({
  loader: () => getLeagueDesk({ data: { league: "CL" } }),
  head: () => ({
    meta: [
      { title: "Ligue des champions en direct : scores, pronos et cotes | BetGPT" },
      {
        name: "description",
        content:
          "Ligue des champions : scores en live, calendrier, pronos BetGPT et meilleures cotes Unibet, Betclic, NetBet.",
      },
      { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1" },
      { property: "og:title", content: "Ligue des champions en direct | BetGPT" },
      {
        property: "og:description",
        content: "Tous les matchs de Ligue des champions, score live dès le coup d’envoi, prono et cote.",
      },
      { property: "og:url", content: `${SITE_URL}/ligue-des-champions` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/ligue-des-champions` }],
  }),
  component: () => {
    const data = Route.useLoaderData();
    return <CupPage league="CL" title="Ligue des champions" data={data} />;
  },
});
