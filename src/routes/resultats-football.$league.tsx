import { createFileRoute, notFound } from "@tanstack/react-router";
import { ResultsBoard, resultsLead } from "@/components/results-board";
import { breadcrumbJsonLd } from "@/lib/cocon";
import { ld } from "@/lib/ld";
import { collectionJsonLd, itemListJsonLd } from "@/lib/programmatic";
import { SITE_URL } from "@/lib/seo";
import { competitionBySlug } from "@/lib/serp/leagues";
import { getResultsBoard } from "@/lib/serp/results.functions";

function pageDescription(title: string, n: number) {
  return n
    ? `Résultats ${title} : ${n} score${n > 1 ? "s" : ""} final${n > 1 ? "aux" : ""}, équipes, dates et fiches des matchs terminés suivis par BetGPT.`
    : `Résultats ${title} : aucun match terminé récent n’est disponible dans les données suivies par BetGPT.`;
}

export const Route = createFileRoute("/resultats-football/$league")({
  loader: async ({ params }) => {
    const comp = competitionBySlug(params.league);
    if (!comp) throw notFound();
    const data = await getResultsBoard();
    return { ...data, comp, rows: data.rows.filter((row) => row.league === comp.league) };
  },
  head: ({ loaderData, params }) => {
    const comp = loaderData?.comp ?? competitionBySlug(params.league);
    if (!comp) return { meta: [{ title: "Résultats | BetGPT" }, { name: "robots", content: "noindex, follow" }] };
    const n = loaderData?.rows.length ?? 0;
    const durableN = loaderData?.rows.filter((row) => row.detailAvailable).length ?? 0;
    const title = `Résultats ${comp.title}`;
    const description = pageDescription(comp.title, n);
    const url = `${SITE_URL}${comp.resultsPath}`;
    return {
      meta: [
        { title: `${title} | BetGPT` },
        { name: "description", content: description },
        { name: "robots", content: durableN ? "index, follow, max-snippet:-1, max-image-preview:large" : "noindex, follow" },
        { property: "og:title", content: `${title} | BetGPT` },
        { property: "og:description", content: description },
        { property: "og:url", content: url },
        { property: "og:type", content: "website" },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: LeagueResults,
});

function LeagueResults() {
  const data = Route.useLoaderData();
  const title = `Résultats ${data.comp.title}`;
  const url = `${SITE_URL}${data.comp.resultsPath}`;
  const description = pageDescription(data.comp.title, data.rows.length);
  const list = data.rows.filter((row) => row.detailAvailable).slice(0, 50).map((row) => ({
    name: `${row.home} ${row.scoreHome}–${row.scoreAway} ${row.away} — ${row.competition}`,
    url: `${SITE_URL}/match/${row.slug}`,
  }));
  const structuredData = [
    collectionJsonLd(title, url, description),
    breadcrumbJsonLd([
      { name: "BetGPT", href: "/" },
      { name: "Résultats football", href: "/resultats-football" },
      { name: data.comp.title, href: data.comp.resultsPath },
    ]),
    ...(list.length ? [itemListJsonLd(title, url, list)] : []),
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld(structuredData) }} />
      <ResultsBoard
        h1={title}
        lead={resultsLead(data.rows, data.comp.title)}
        sections={[{ id: data.comp.slug, title: data.comp.title, rows: data.rows }]}
        asOf={data.asOf}
      />
    </>
  );
}
