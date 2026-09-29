import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { CoconMesh } from "@/components/cocon-mesh";
import { FollowStar } from "@/components/follow-star";
import { Methodology } from "@/components/methodology";
import { ScoreTable } from "@/components/score-table";
import { getScoreExplorer } from "@/lib/hunter.functions";
import { SLUG_LEAGUE } from "@/engine/stats";
import { breadcrumbJsonLd } from "@/lib/cocon";
import { BRAND_OG, imageHeadTags } from "@/lib/image-seo";
import { ld } from "@/lib/ld";
import { SITE_URL } from "@/lib/programmatic";
import { fmtPct } from "@/lib/utils";

export const Route = createFileRoute("/statistics/$league/most-common-scores")({
  validateSearch: (s: Record<string, unknown>) => ({
    season: typeof s.season === "string" ? s.season : undefined,
  }),
  loaderDeps: ({ search }) => ({ season: search.season ?? "all" }),
  loader: async ({ params, deps }) => {
    if (!SLUG_LEAGUE[params.league]) throw notFound();
    return getScoreExplorer({ data: { league: params.league, season: deps.season } });
  },
  head: ({ loaderData, params }) => {
    const label = loaderData?.leagueLabel ?? params.league;
    const top = loaderData?.counts[0];
    const n = loaderData?.provenance.n ?? 0;
    const title = `Scores les plus fréquents en ${label} | BetGPT`;
    const desc = top
      ? `${label} : ${top.score.replace("-", "–")} dans ${fmtPct(top.freq)} des matches (n=${n}). Archive ESPN, pas de stats fictives.`
      : `Scores exacts ${label}.`;
    const url = `${SITE_URL}/statistics/${params.league}/most-common-scores`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1" },
        { property: "og:title", content: title },
        { property: "og:url", content: url },
        ...imageHeadTags(BRAND_OG),
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  notFoundComponent: () => <p className="text-muted">Ligue inconnue.</p>,
  component: LeagueScores,
});

function LeagueScores() {
  const data = Route.useLoaderData();
  const params = Route.useParams();
  const top = data.counts[0];
  return (
    <article className="space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: ld(
            breadcrumbJsonLd([
              { name: "BetGPT", href: "/" },
              { name: "Statistiques", href: "/statistics" },
              { name: data.leagueLabel, href: `/statistics/${params.league}/most-common-scores` },
            ]),
          ),
        }}
      />
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Scores les plus fréquents — {data.leagueLabel}</h1>
          <p className="seo-answer mt-2 max-w-3xl text-sm leading-relaxed text-paper">
            {data.provenance.n
              ? `${top ? `Score le plus vu : ${top.score.replace("-", "–")} (${fmtPct(top.freq)}, ${top.n} matches). ` : ""}n=${data.provenance.n} · ${data.seasonLabel}.`
              : "Aucun match dans cette fenêtre. Rien n’est inventé."}
          </p>
        </div>
        {data.league ? <FollowStar kind="league" id={data.league} label={data.leagueLabel} /> : null}
      </header>
      <ScoreTable rows={data.counts} caption={`Scores ${data.leagueLabel}`} totalN={data.countsSum ?? data.provenance.n} />
      <p className="text-sm">
        <a href="/statistics/most-common-scores" className="text-sage">
          Toutes ligues
        </a>
        {" · "}
        <Link to="/score-hunter/$scenario" params={{ scenario: "2-1" }} className="text-sage">
          2-1 Hunter
        </Link>
      </p>
      <Methodology n={data.historyN} extra={`${data.leagueLabel} · ${data.seasonLabel}.`} />
      <CoconMesh
        crumbs={[
          { name: "BetGPT", href: "/" },
          { name: "Statistiques", href: "/statistics" },
          { name: data.leagueLabel, href: `/statistics/${params.league}/most-common-scores` },
        ]}
        parent={{ href: "/statistics/most-common-scores", anchor: "Scores les plus fréquents", rel: "parent" }}
        sisters={data.leagues
          .filter((l) => l.slug !== params.league)
          .slice(0, 6)
          .map((l) => ({ href: `/statistics/${l.slug}/most-common-scores`, anchor: l.label, rel: "sister" as const }))}
        children={[
          { href: "/statistics/leagues/lowest-0-0", anchor: "Radar 0-0", rel: "child" },
          { href: "/score-hunter", anchor: "Score Hunter", rel: "child" },
        ]}
      />
    </article>
  );
}
