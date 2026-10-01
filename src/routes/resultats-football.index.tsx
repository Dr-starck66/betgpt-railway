import { createFileRoute } from "@tanstack/react-router";
import { ResultsBoard, dayTitle, resultsLead } from "@/components/results-board";
import { breadcrumbJsonLd } from "@/lib/cocon";
import { ld } from "@/lib/ld";
import { collectionJsonLd, itemListJsonLd } from "@/lib/programmatic";
import { SITE_URL } from "@/lib/seo";
import { recentResultDays } from "@/lib/serp/results";
import { getResultsBoard } from "@/lib/serp/results.functions";

const H1 = "Résultats football : scores du jour et matchs terminés";
const DESCRIPTION =
  "Résultats football : scores finaux du jour et des 7 derniers jours, classés par date et compétition. Ligue 1, Premier League, Liga, Serie A, Bundesliga et coupes d’Europe.";

export const Route = createFileRoute("/resultats-football/")({
  loader: () => getResultsBoard(),
  head: () => ({
    meta: [
      { title: `${H1} | BetGPT` },
      { name: "description", content: DESCRIPTION },
      { name: "robots", content: "index, follow, max-snippet:-1, max-image-preview:large" },
      { property: "og:title", content: `${H1} | BetGPT` },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: `${SITE_URL}/resultats-football` },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/resultats-football` }],
  }),
  component: ResultsHome,
});

function ResultsHome() {
  const data = Route.useLoaderData();
  const days = recentResultDays(data.rows, Date.now(), 7);
  const today = days[0]?.rows ?? [];
  const lead = resultsLead(today.length ? today : data.rows, today.length ? "aujourd’hui" : "récents");
  const sections = days.map(({ day, rows }, index) => ({
    id: day,
    title: index === 0 ? "Aujourd’hui" : index === 1 ? "Hier" : dayTitle(day),
    rows,
  }));

  const url = `${SITE_URL}/resultats-football`;
  const list = sections
    .flatMap((section) => section.rows)
    .slice(0, 50)
    .map((row) => ({
      name: `${row.home} ${row.scoreHome}–${row.scoreAway} ${row.away} — ${row.competition}`,
      url: `${SITE_URL}/match/${row.slug}`,
    }));
  const structuredData = [
    collectionJsonLd(H1, url, DESCRIPTION),
    breadcrumbJsonLd([
      { name: "BetGPT", href: "/" },
      { name: "Résultats football", href: "/resultats-football" },
    ]),
    ...(list.length ? [itemListJsonLd("Derniers résultats football", url, list)] : []),
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld(structuredData) }} />
      <ResultsBoard h1={H1} lead={lead} sections={sections} asOf={data.asOf} showSeoGuide />
    </>
  );
}
