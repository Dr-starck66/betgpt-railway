import { createFileRoute, notFound } from "@tanstack/react-router";
import { PronoSilo, filterSiloMatches } from "@/components/prono-silo";
import { getLeagueDesk } from "@/lib/desk.functions";
import { pronoLeagueBySlug, siloIndexable } from "@/lib/seo/money-map";
import { SITE_URL } from "@/lib/programmatic";

export const Route = createFileRoute("/pronostics-football/$league")({
  loader: async ({ params }) => {
    const resolved = pronoLeagueBySlug(params.league);
    if (!resolved) throw notFound();
    const desk = await getLeagueDesk({ data: { league: resolved.league } });
    return {
      meta: { slug: resolved.slug, league: resolved.league, title: resolved.title },
      desk,
      isAlias: resolved.isAlias,
    };
  },
  head: ({ loaderData, params }) => {
    const resolved = loaderData?.meta ?? pronoLeagueBySlug(params.league);
    if (!resolved) {
      return {
        meta: [
          { title: "Pronostic football | BetGPT" },
          { name: "robots", content: "noindex, follow" },
        ],
      };
    }
    const title = `Pronostic ${resolved.title} : probabilités | BetGPT`;
    const path = `/pronostics-football/${resolved.slug}`;
    const n = loaderData ? filterSiloMatches(loaderData.desk, { league: resolved.league }).length : 0;
    const alias = params.league !== resolved.slug;
    return {
      meta: [
        { title },
        {
          name: "description",
          content: n
            ? `Pronostics ${resolved.title} issus du bureau BetGPT : modèle, cote listée, écart et décision. Sans match inventé.`
            : `Pronostic ${resolved.title} : méthode BetGPT, accès au calendrier, classement, scores et résultats pendant l’attente du prochain match exploitable.`,
        },
        { name: "robots", content: alias ? "noindex, follow" : siloIndexable("league", n) ? "index, follow" : "noindex, follow" },
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
  const n = filterSiloMatches(desk, { league: meta.league }).length;
  return (
    <PronoSilo
      h1={`Pronostic ${meta.title}`}
      lead={
        n
          ? `${n} match${n > 1 ? "s" : ""} de ${meta.title} ${n > 1 ? "ont" : "a"} actuellement une estimation dans le bureau BetGPT. Le classement, le calendrier, les scores et les résultats restent accessibles depuis cette page.`
          : `Aucun match de ${meta.title} n’est actuellement exploitable dans la fenêtre du bureau. La page reste utile : méthode de lecture, calendrier, classement, scores et résultats sont disponibles sans inventer de rencontre ni de cote.`
      }
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
