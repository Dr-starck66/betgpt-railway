import { createFileRoute } from "@tanstack/react-router";
import { PronoSilo, filterSiloMatches } from "@/components/prono-silo";
import { getPublicDesk } from "@/lib/desk.functions";
import { SITE_URL } from "@/lib/programmatic";

export const Route = createFileRoute("/pronostics-football/")({
  loader: () => getPublicDesk(),
  head: () => ({
    meta: [
      { title: "Pronostics football du jour : analyses 1N2 et cotes | BetGPT" },
      {
        name: "description",
        content:
          "Pronostics football du jour BetGPT : estimation 1N2, probabilité, cote et décision claire. Résultats conservés et bilan vérifiable.",
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
      h1="Pronostics football du jour"
      lead={`${filterSiloMatches(desk, {}).length} matchs ont une estimation dans la fenêtre actuelle. Chaque fiche sépare le pronostic principal 1N2, la probabilité du modèle, la cote disponible et la décision PARIER, ATTENDRE ou NE PAS PARIER.`}
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
