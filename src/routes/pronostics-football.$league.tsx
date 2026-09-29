import { createFileRoute, notFound } from "@tanstack/react-router";
import { PronoSilo, filterSiloMatches } from "@/components/prono-silo";
import { getLeagueDesk } from "@/lib/desk.functions";
import { PRONO_LEAGUES, siloIndexable } from "@/lib/seo/money-map";
import { SITE_URL } from "@/lib/programmatic";

export const Route = createFileRoute("/pronostics-football/$league")({
  loader: async ({ params }) => {
    const meta = PRONO_LEAGUES.find((l) => l.slug === params.league);
    if (!meta) throw notFound();
    const desk = await getLeagueDesk({ data: { league: meta.league } });
    return { meta, desk };
  },
  head: ({ loaderData, params }) => {
    const title = loaderData ? `Pronostic ${loaderData.meta.title} : probabilités | BetGPT` : "Pronostic";
    const path = `/pronostics-football/${params.league}`;
    const n = loaderData ? filterSiloMatches(loaderData.desk, { league: loaderData.meta.league }).length : 0;
    return {
      meta: [
        { title },
        {
          name: "description",
          content: loaderData
            ? `Pronostics ${loaderData.meta.title} issus du bureau BetGPT : modèle, cote listée et écart. Sans match inventé.`
            : "Compétition introuvable.",
        },
        { name: "robots", content: siloIndexable("league", n) ? "index, follow" : "noindex, follow" },
        { property: "og:url", content: `${SITE_URL}${path}` },
      ],
      links: [{ rel: "canonical", href: `${SITE_URL}${path}` }],
    };
  },
  notFoundComponent: () => <p className="text-muted">Compétition introuvable.</p>,
  component: Page,
});

function Page() {
  const { meta, desk } = Route.useLoaderData();
  return (
    <PronoSilo
      h1={`Pronostic ${meta.title}`}
      lead={`Uniquement les matchs de ${meta.title} présents dans le bureau. Le classement et le calendrier de la compétition restent sur leurs pages dédiées.`}
      path={`/pronostics-football/${meta.slug}`}
      kind="league"
      desk={desk}
      filter={{ league: meta.league }}
      crumbs={[
        { href: "/pronostics-sportifs", name: "Pronostics sportifs" },
        { href: "/pronostics-football", name: "Football" },
        { href: `/pronostics-football/${meta.slug}`, name: meta.title },
      ]}
    />
  );
}
