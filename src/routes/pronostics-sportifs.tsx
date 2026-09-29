import { createFileRoute } from "@tanstack/react-router";
import { PronoSilo, filterSiloMatches } from "@/components/prono-silo";
import { getPublicDesk } from "@/lib/desk.functions";
import { SITE_URL } from "@/lib/programmatic";
import { siloIndexable } from "@/lib/seo/money-map";

export const Route = createFileRoute("/pronostics-sportifs")({
  loader: () => getPublicDesk(),
  head: ({ loaderData }) => {
    const n = loaderData ? filterSiloMatches(loaderData, {}).length : 0;
    const index = siloIndexable("pillar", n);
    const title = "Pronostics sportifs : probabilités, cotes et écarts | BetGPT";
    const description =
      "Pronostics sportifs football du bureau BetGPT : probabilité du modèle, cote listée, probabilité implicite et écart. Pas un bookmaker.";
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
      lead="BetGPT couvre le football. Chaque ligne ci-dessous vient du bureau en cours : équipes, horaire, pronostic 1N2 le plus probable, probabilité du modèle, et la cote seulement si un bookmaker l’a listée. L’écart est modèle moins probabilité implicite."
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
