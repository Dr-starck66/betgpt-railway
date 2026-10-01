import { createFileRoute } from "@tanstack/react-router";
import { PronoSilo, filterSiloMatches } from "@/components/prono-silo";
import { getPublicDesk } from "@/lib/desk.functions";
import { SITE_URL } from "@/lib/programmatic";
import { siloIndexable } from "@/lib/seo/money-map";

export const Route = createFileRoute("/pronostics-sportifs")({
  loader: async () => {
    const desk = await getPublicDesk();
    return {
      ...desk,
      engineVersion: undefined,
      tacticalVersion: undefined,
      predictions: desk.predictions.map((prediction) => ({
        ...prediction,
        engineVersion: undefined,
        tacticalVersion: undefined,
      })),
    } as typeof desk;
  },
  head: ({ loaderData }) => {
    const n = loaderData ? filterSiloMatches(loaderData, {}).length : 0;
    const index = siloIndexable("pillar", n);
    const title = "Pronostics sportifs : probabilités, cotes et écarts | BetGPT";
    const description =
      "Pronostics football BetGPT : équipes, horaire, probabilité estimée, cote disponible, écart avec le marché et consigne claire pour savoir s’il faut parier, attendre ou passer.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "robots", content: index ? "index, follow" : "noindex, follow" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: `${SITE_URL}/pronostics-sportifs` },
      ],
      links: [{ rel: "canonical", href: `${SITE_URL}/pronostics-sportifs` }],
    };
  },
  component: Page,
});

function Page() {
  const desk = Route.useLoaderData();
  return (
    <PronoSilo
      h1="Pronostics sportifs"
      lead="Chaque match affiche les équipes, l’horaire, le pronostic 1N2, notre probabilité estimée, la cote disponible et surtout une consigne claire : PARIER, ATTENDRE ou NE PAS PARIER. Aucune cote inférieure à 1,80 n’est retenue ni mise en avant."
      path="/pronostics-sportifs"
      kind="pillar"
      desk={desk}
      filter={{}}
      crumbs={[
        { href: "/", name: "Accueil" },
        { href: "/pronostics-sportifs", name: "Pronostics sportifs" },
      ]}
    />
  );
}
