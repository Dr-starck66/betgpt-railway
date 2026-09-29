import { createFileRoute } from "@tanstack/react-router";
import { CupPage } from "@/components/cup-page";
import { getLeagueDesk } from "@/lib/desk.functions";
import { SITE_URL } from "@/lib/seo";

export const Route = createFileRoute("/ligue-europa")({
  loader: () => getLeagueDesk({ data: { league: "EL" } }),
  head: () => ({
    meta: [
      { title: "Ligue Europa en direct : scores, pronos et cotes | BetGPT" },
      {
        name: "description",
        content:
          "Ligue Europa : scores en live, calendrier, pronos BetGPT et meilleures cotes Unibet, Betclic, NetBet. Mise à jour à chaque match.",
      },
      { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1" },
      { property: "og:title", content: "Ligue Europa en direct | BetGPT" },
      {
        property: "og:description",
        content: "Tous les matchs de Ligue Europa, score live dès le coup d’envoi, prono et cote.",
      },
      { property: "og:url", content: `${SITE_URL}/ligue-europa` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/ligue-europa` }],
  }),
  component: () => {
    const data = Route.useLoaderData();
    return <CupPage league="EL" title="Ligue Europa" data={data} />;
  },
});
