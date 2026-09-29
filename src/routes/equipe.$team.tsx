import { createFileRoute, notFound } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Crest } from "@/components/crest";
import { LiveScore } from "@/components/live-score";
import { getTeamDesk } from "@/lib/desk.functions";
import { crestSeo, imageHeadTags, imageObjectLd } from "@/lib/image-seo";
import { collectionJsonLd, itemListJsonLd, SITE_URL, slugify, teamPath } from "@/lib/programmatic";
import { ld } from "@/lib/ld";
import { CoconMesh } from "@/components/cocon-mesh";
import { meshTeam } from "@/lib/cocon";
import { featuredAnswer, matchPath } from "@/lib/seo";
import { headlineMarket } from "@/lib/markets";
import { parisLong } from "@/lib/serp/answer";
import { fmtOdds } from "@/lib/utils";

export const Route = createFileRoute("/equipe/$team")({
  loader: async ({ params }) => {
    const page = await getTeamDesk({ data: { team: params.team } });
    if (!page) throw notFound();
    return page;
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const { name } = loaderData;
    const title = `${name} : résultat, calendrier et prochain match | BetGPT`;
    const desc = `Résultat ${name}, prochain match, calendrier et score. Pages en français, pour la France.`;
    const url = `${SITE_URL}${teamPath(name)}`;
    const seo = crestSeo(name);
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { name: "robots", content: "index, follow, max-snippet:-1, max-image-preview:large" },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:url", content: url },
        ...imageHeadTags(seo.src ? seo : { ...seo, src: "/og-betgpt-pronostics-cotes-football.jpg" }),
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  notFoundComponent: () => <p className="text-muted">Équipe introuvable sur cette fenêtre.</p>,
  component: TeamPage,
});

function TeamPage() {
  const { matches, name, predictions } = Route.useLoaderData();
  const byId = new Map(predictions.map((p) => [p.matchId, p]));
  const url = `${SITE_URL}${teamPath(name)}`;
  const sample = matches[0]!;
  const profile = slugify(sample.home.name) === slugify(name) ? sample.home : sample.away;
  const seo = crestSeo(name, { competition: sample.competition, id: profile.id, logo: profile.logo });
  const list = matches.map((m) => ({
    name: `${m.home.name} – ${m.away.name}`,
    url: `${SITE_URL}${matchPath(m)}`,
  }));
  const now = Date.now();
  const next = [...matches]
    .filter((m) => m.status !== "finished" && m.status !== "cancelled" && Date.parse(m.kickoff) >= now - 3 * 60 * 60 * 1000)
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff))[0];
  const last = [...matches]
    .filter((m) => m.status === "finished" && m.scoreHome != null && m.scoreAway != null)
    .sort((a, b) => b.kickoff.localeCompare(a.kickoff))[0];
  const nextLabel = next
    ? `Prochain match ${name} : ${next.home.name} – ${next.away.name}, ${parisLong(next.kickoff) || "heure à confirmer"}.`
    : `Aucun prochain match ${name} n’est listé sur cette fenêtre.`;
  const lastLabel = last
    ? `Dernier résultat ${name} : ${last.home.name} ${last.scoreHome}–${last.scoreAway} ${last.away.name}.`
    : `Aucun résultat récent ${name} n’est listé ici.`;
  return (
    <div className="space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: ld([
            {
              "@context": "https://schema.org",
              "@type": "SportsTeam",
              name,
              url,
              sport: "Soccer",
              logo: seo.src ? imageObjectLd(seo, url) : undefined,
            },
            collectionJsonLd(`${name} : résultat et calendrier`, url, `${nextLabel} ${lastLabel}`),
            itemListJsonLd(`Matchs ${name}`, url, list),
          ]),
        }}
      />
      <header className="flex items-start gap-4">
        <Crest
          name={name}
          short={profile.short}
          logo={profile.logo}
          color={profile.color}
          id={profile.id}
          size={72}
          competition={sample.competition}
        />
        <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {name} : résultat, calendrier et prochain match
        </h1>
        <p className="seo-answer mt-2 max-w-3xl text-base text-paper">
          {nextLabel} {lastLabel}{" "}
          <a href="/scores-en-direct" className="text-sage hover:underline">
            Scores en direct
          </a>
          .
        </p>
        </div>
      </header>
      <CoconMesh {...meshTeam(name, matches[0]!.league, matches)} />
      <ul className="space-y-3">
        {matches.map((m) => {
          const p = byId.get(m.id);
          const pick = p ? headlineMarket(p.markets) : null;
          return (
            <li key={m.id} className="rounded-lg border border-line bg-surface p-4">
              <Link to="/match/$matchId" params={{ matchId: m.slug ?? m.id }} className="block">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Crest name={m.home.name} short={m.home.short} logo={m.home.logo} color={m.home.color} id={m.home.id} size={28} />
                    <h2 className="text-base font-semibold">
                      {m.home.name} – {m.away.name} : pronostic et analyse du match
                    </h2>
                    <Crest name={m.away.name} short={m.away.short} logo={m.away.logo} color={m.away.color} id={m.away.id} size={28} />
                  </div>
                  <LiveScore match={m} size="sm" />
                </div>
                <p className="mt-2 text-sm text-mist">{p ? featuredAnswer(m, p) : featuredAnswer(m)}</p>
                {pick ? (
                  <p className="mt-1 text-xs text-muted">
                    Pronostic {pick.label} · {fmtOdds(pick.bestOdds)}
                  </p>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
