import { createFileRoute } from "@tanstack/react-router";
import { ZeroRadarView } from "@/components/zero-radar";
import { getZeroRadar } from "@/lib/hunter.functions";
import { BRAND_OG, imageHeadTags } from "@/lib/image-seo";
import { SITE_URL } from "@/lib/programmatic";
import { fmtPct } from "@/lib/utils";
import { AstraSidewings } from "@/components/astra-sidewings";

export const Route = createFileRoute("/statistics/leagues/highest-0-0")({
  validateSearch: (s: Record<string, unknown>) => ({
    season: typeof s.season === "string" ? s.season : undefined,
  }),
  loaderDeps: ({ search }) => ({ season: search.season ?? "last-5" }),
  loader: ({ deps }) => getZeroRadar({ data: { season: deps.season, sort: "high" } }),
  head: ({ loaderData }) => {
    const top = loaderData?.leagues[0];
    const title = "Ligues avec le plus de 0-0 | BetGPT";
    const desc = top
      ? `${top.label} a ${fmtPct(top.freq)} de 0-0 (n=${top.n}). Radar 0-0 BetGPT, archive ESPN.`
      : "Ligues avec le plus de matches 0-0.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1" },
        { property: "og:title", content: title },
        { property: "og:url", content: `${SITE_URL}/statistics/leagues/highest-0-0` },
        ...imageHeadTags(BRAND_OG),
      ],
      links: [{ rel: "canonical", href: `${SITE_URL}/statistics/leagues/highest-0-0` }],
    };
  },
  component: Page,
});

function Page() {
  const data = Route.useLoaderData();
  const top = data.leagues.find((l) => l.n >= 10);
  const intro = top
    ? `${data.seasonLabel} : ${top.label} a le plus de 0-0 parmi les ligues avec n≥10 (${fmtPct(top.freq)}, ${top.n00}/${top.n}). Archive ESPN.`
    : `${data.seasonLabel} : échantillon insuffisant.`;
  return (
    <AstraSidewings
      ariaLabel="Ligues avec le plus de 0-0 — navigation statistique"
      left={{
        eyebrow: "Radar 0-0",
        title: "Explorer les statistiques",
        intro: "Compare cette lecture avec les autres vues statistiques BetGPT.",
        links: [
          { href: "/statistics", label: "Toutes les statistiques", description: "Revenir au hub des statistiques football." },
          { href: "/statistics/leagues/lowest-0-0", label: "Ligues avec le moins de 0-0", description: "Voir l’autre extrême du même indicateur." },
          { href: "/statistics/most-common-scores", label: "Scores les plus fréquents", description: "Comparer le 0-0 aux distributions de scores observées." },
          { href: "/score-hunter", label: "Score Hunter", description: "Explorer les scénarios de scores à partir des données disponibles." },
        ],
      }}
      right={{
        eyebrow: "Fiabilité",
        title: "Interpréter le signal",
        intro: top ? `${top.label} est le premier échantillon éligible affiché ici pour ${data.seasonLabel}.` : "Échantillon insuffisant pour établir un classement robuste.",
        stats: top ? [
          { label: "Fréquence 0-0", value: fmtPct(top.freq), detail: `${top.n00} sur ${top.n} matchs dans l’échantillon.` },
          { label: "Ligue", value: top.label, detail: data.seasonLabel },
        ] : [],
        links: [
          { href: "/methodology", label: "Méthodologie", description: "Comment BetGPT transforme les données en indicateurs." },
          { href: "/data-sources", label: "Sources des données", description: "Origine, couverture et limites des archives utilisées." },
          { href: "/rapports/precision", label: "Rapport de précision", description: "Voir les contrôles de calibration et d’erreur." },
        ],
      }}
    >
      <ZeroRadarView
      title="Ligues et clubs avec le plus de 0-0"
      intro={intro}
      sort="high"
      season={data.season}
      seasonLabel={data.seasonLabel}
      leagues={data.leagues}
      teams={data.teams}
      empty={data.empty}
      historyN={data.historyN}
      provenance={data.provenance}
      path="/statistics/leagues/highest-0-0"
    />
    </AstraSidewings>
  );
}
