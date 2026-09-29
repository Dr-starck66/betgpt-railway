import { createFileRoute, Link } from "@tanstack/react-router";
import { CoconMesh } from "@/components/cocon-mesh";
import { Methodology } from "@/components/methodology";
import { ScoreTable } from "@/components/score-table";
import { getScoreExplorer } from "@/lib/hunter.functions";
import { breadcrumbJsonLd } from "@/lib/cocon";
import { BRAND_OG, imageHeadTags } from "@/lib/image-seo";
import { ld } from "@/lib/ld";
import { SITE_URL } from "@/lib/programmatic";
import { fmtPct } from "@/lib/utils";

const SEASONS = [
  { id: "all", label: "Toutes" },
  { id: "current", label: "Saison en cours" },
  { id: "prev", label: "Saison précédente" },
  { id: "last-3", label: "3 saisons complètes" },
  { id: "last-5", label: "5 saisons complètes" },
] as const;

export const Route = createFileRoute("/statistics/most-common-scores")({
  validateSearch: (s: Record<string, unknown>) => ({
    season: typeof s.season === "string" ? s.season : undefined,
    lastN: typeof s.lastN === "string" ? Number(s.lastN) : typeof s.lastN === "number" ? s.lastN : undefined,
  }),
  loaderDeps: ({ search }) => ({ season: search.season ?? "all", lastN: search.lastN }),
  loader: ({ deps }) => getScoreExplorer({ data: { season: deps.season, lastN: deps.lastN } }),
  head: ({ loaderData }) => {
    const n = loaderData?.provenance.n ?? 0;
    const title = "Scores les plus fréquents en football | BetGPT";
    const top = loaderData?.counts[0];
    const desc = top
      ? `Le score ${top.score.replace("-", "–")} sort dans ${fmtPct(top.freq)} des matches (n=${n}, archive ESPN).`
      : "Fréquences de scores exacts, archive ESPN.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1" },
        { property: "og:title", content: title },
        { property: "og:url", content: `${SITE_URL}/statistics/most-common-scores` },
        ...imageHeadTags(BRAND_OG),
      ],
      links: [{ rel: "canonical", href: `${SITE_URL}/statistics/most-common-scores` }],
    };
  },
  component: ExplorerPage,
});

function ExplorerPage() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
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
              { name: "Scores les plus fréquents", href: "/statistics/most-common-scores" },
            ]),
          ),
        }}
      />
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Scores les plus fréquents</h1>
        <p className="seo-answer mt-2 max-w-3xl text-sm leading-relaxed text-paper">
          {top
            ? `Sur ${data.provenance.n.toLocaleString("fr-FR")} matches (${data.seasonLabel}), le score le plus vu est ${top.score.replace("-", "–")} (${fmtPct(top.freq)}, ${top.n} matches).`
            : "Aucun match dans cette fenêtre. Pas de fréquence fictive."}{" "}
          Source : {data.source}.
        </p>
      </header>
      <div className="flex flex-wrap gap-2">
        {SEASONS.map((s) => (
          <a
            key={s.id}
            href={s.id === "all" ? "/statistics/most-common-scores" : `/statistics/most-common-scores?season=${s.id}`}
            className={`inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium ${
              (search.season ?? "all") === s.id ? "bg-sage text-ink" : "border border-line text-mist"
            }`}
          >
            {s.label}
          </a>
        ))}
      </div>
      <p className="flex flex-wrap gap-2 text-sm">
        {data.leagues.map((l) => (
          <a
            key={l.id}
            href={`/statistics/${l.slug}/most-common-scores`}
            className="rounded-md border border-line px-3 py-2 hover:border-sage"
          >
            {l.label}
          </a>
        ))}
      </p>
      <ScoreTable
        rows={data.counts}
        caption={`Scores les plus fréquents, ${data.seasonLabel}`}
        totalN={data.countsSum ?? data.provenance.n}
      />
      <p className="text-xs text-muted">
        n={data.provenance.n}
        {data.provenance.from ? ` · ${data.provenance.from} → ${data.provenance.to}` : ""}
        {data.countsSum != null ? ` · somme des scores exacts=${data.countsSum}` : ""}
        {data.source ? ` · ${data.source}` : ""}
      </p>
      <Methodology n={data.historyN} extra={data.seasonLabel} />
      <CoconMesh
        crumbs={[
          { name: "BetGPT", href: "/" },
          { name: "Statistiques", href: "/statistics" },
          { name: "Scores fréquents", href: "/statistics/most-common-scores" },
        ]}
        parent={{ href: "/statistics", anchor: "Statistiques football", rel: "parent" }}
        sisters={[
          { href: "/statistics/leagues/lowest-0-0", anchor: "Moins de 0-0", rel: "sister" },
          { href: "/statistics/leagues/highest-0-0", anchor: "Plus de 0-0", rel: "sister" },
          { href: "/score-hunter", anchor: "Score Hunter", rel: "sister" },
        ]}
        children={data.leagues.map((l) => ({
          href: `/statistics/${l.slug}/most-common-scores`,
          anchor: `Scores ${l.label}`,
          rel: "child" as const,
        }))}
      />
    </article>
  );
}
