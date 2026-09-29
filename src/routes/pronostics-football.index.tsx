import { createFileRoute } from "@tanstack/react-router";
import { PronoSilo, filterSiloMatches } from "@/components/prono-silo";
import { getPublicDesk } from "@/lib/desk.functions";
import { SITE_URL } from "@/lib/programmatic";

export const Route = createFileRoute("/pronostics-football/")({
  loader: () => getPublicDesk(),
  head: () => ({
    meta: [
      { title: "Pronostics football : compétitions, aujourd’hui et demain | BetGPT" },
      {
        name: "description",
        content:
          "Hub des pronostics football BetGPT. Ligue 1, Premier League, Liga, Bundesliga, Serie A, Ligue des champions et Ligue Europa.",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:url", content: `${SITE_URL}/pronostics-football` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/pronostics-football` }],
  }),
  component: Page,
});

function Page() {
  const desk = Route.useLoaderData();
  return (
    <PronoSilo
      h1="Pronostics football"
      lead={`Pages par jour et par compétition. ${filterSiloMatches(desk, {}).length} matchs ont une estimation dans la fenêtre actuelle. Le bureau opérationnel reste sur Pronos football.`}
      path="/pronostics-football"
      kind="football"
      desk={desk}
      filter={{}}
      crumbs={[
        { href: "/", name: "Accueil" },
        { href: "/pronostics-sportifs", name: "Pronostics sportifs" },
        { href: "/pronostics-football", name: "Football" },
      ]}
    />
  );
}
