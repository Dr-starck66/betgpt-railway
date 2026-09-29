import { createFileRoute } from "@tanstack/react-router";
import { ZeroRadarView } from "@/components/zero-radar";
import { getZeroRadar } from "@/lib/hunter.functions";
import { BRAND_OG, imageHeadTags } from "@/lib/image-seo";
import { SITE_URL } from "@/lib/programmatic";
import { fmtPct } from "@/lib/utils";

export const Route = createFileRoute("/statistics/leagues/lowest-0-0")({
  validateSearch: (s: Record<string, unknown>) => ({
    season: typeof s.season === "string" ? s.season : undefined,
  }),
  loaderDeps: ({ search }) => ({ season: search.season ?? "last-5" }),
  loader: ({ deps }) => getZeroRadar({ data: { season: deps.season, sort: "low" } }),
  head: ({ loaderData }) => {
    const top = loaderData?.leagues[0];
    const title = "Ligues avec le moins de 0-0 | BetGPT";
    const desc = top
      ? `${top.label} a ${fmtPct(top.freq)} de 0-0 (n=${top.n}). Radar 0-0 BetGPT, archive ESPN.`
      : "Ligues avec le moins de matches 0-0.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1" },
        { property: "og:title", content: title },
        { property: "og:url", content: `${SITE_URL}/statistics/leagues/lowest-0-0` },
        ...imageHeadTags(BRAND_OG),
      ],
      links: [{ rel: "canonical", href: `${SITE_URL}/statistics/leagues/lowest-0-0` }],
    };
  },
  component: Page,
});

function Page() {
  const data = Route.useLoaderData();
  const top = data.leagues.find((l) => l.n >= 10);
  const intro = top
    ? `${data.seasonLabel} : ${top.label} a le moins de 0-0 parmi les ligues avec n≥10 (${fmtPct(top.freq)}, ${top.n00}/${top.n}). Archive ESPN, n global=${data.provenance.n.toLocaleString("fr-FR")}.`
    : `${data.seasonLabel} : échantillon insuffisant. Aucune ligue classée.`;
  return (
    <ZeroRadarView
      title="Ligues et clubs avec le moins de 0-0"
      intro={intro}
      sort="low"
      season={data.season}
      seasonLabel={data.seasonLabel}
      leagues={data.leagues}
      teams={data.teams}
      empty={data.empty}
      historyN={data.historyN}
      provenance={data.provenance}
      path="/statistics/leagues/lowest-0-0"
    />
  );
}
