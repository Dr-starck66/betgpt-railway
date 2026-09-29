import { createFileRoute } from "@tanstack/react-router";
import { ScoresHub } from "@/components/scores-hub";
import { getPublicDesk } from "@/lib/desk.functions";
import { SITE_URL } from "@/lib/seo";

export const Route = createFileRoute("/pronos-football")({
  loader: () => getPublicDesk(),
  head: () => ({
    meta: [
      { title: "Pronos football du jour : cotes et value bets | BetGPT" },
      {
        name: "description",
        content:
          "Pronostics football du jour. Qui va gagner, quelle cote, quel value bet. Ligue 1, Ligue des champions, Ligue Europa, Premier League.",
      },
      { name: "robots", content: "index, follow, max-snippet:-1" },
      { property: "og:url", content: `${SITE_URL}/pronos-football` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/pronos-football` }],
  }),
  component: () => {
    const data = Route.useLoaderData();
    return (
      <ScoresHub
        title="Pronos football du jour"
        lead={`Pronostics BetGPT sur ${data.summary.nMatches} matchs. Cotes comparées chez les books FR. Un value bet par opportunité.`}
        data={data}
        path="/pronos-football"
        intent="prono"
      />
    );
  },
});
