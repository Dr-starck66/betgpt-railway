import { Link } from "@tanstack/react-router";
import { Crest, TeamLine } from "@/components/crest";
import { LiveScore } from "@/components/live-score";
import { CoconMesh } from "@/components/cocon-mesh";
import { getPublicDesk } from "@/lib/desk.functions";
import { meshHub, breadcrumbJsonLd } from "@/lib/cocon";
import { hubByLeague, slugify } from "@/lib/programmatic";
import { useLiveRefresh } from "@/lib/live-refresh";
import { betMarket } from "@/lib/markets";
import { skipEuropeFrenchProno } from "@/engine/french-clubs";
import { collectionJsonLd, itemListJsonLd, SITE_URL } from "@/lib/programmatic";
import { ld } from "@/lib/ld";
import { featuredAnswer, matchPath } from "@/lib/seo";
import { fmtOdds } from "@/lib/utils";
import { hasScore, scoreFreshness, statusLabel, strictStatus } from "@/lib/serp/status";
import { competitionByLeague } from "@/lib/serp/leagues";
import { parisTime } from "@/lib/serp/answer";

type Desk = Awaited<ReturnType<typeof getPublicDesk>>;

export function ScoresHub({
  title,
  lead,
  data,
  path,
  intent = "score",
}: {
  title: string;
  lead: string;
  data: Desk;
  path: string;
  intent?: "score" | "prono" | "cote";
}) {
  const mesh = meshHub(path, title, data.matches, intent);
  const liveNow = data.matches.filter((m) => m.status === "live");
  const leagues = [...new Set(data.matches.map((m) => m.league))];
  useLiveRefresh(liveNow.length > 0);
  const byId = new Map(data.predictions.map((p) => [p.matchId, p]));
  const ordered = [...data.matches].sort((a, b) => {
    const rank = (s?: string) => (s === "live" ? 0 : s === "scheduled" ? 1 : 2);
    const d = rank(a.status) - rank(b.status);
    return d !== 0 ? d : a.kickoff.localeCompare(b.kickoff);
  });
  const url = `${SITE_URL}${path}`;
  const fresh = scoreFreshness(data.liveAsOf);
  const liveStale = liveNow.length > 0 && (data.liveStale || fresh.stale);
  const list = ordered.slice(0, 40).map((m) => ({
    name: `${m.home.name} – ${m.away.name}`,
    url: `${SITE_URL}${matchPath(m)}`,
  }));

  return (
    <div className="space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: ld([
            collectionJsonLd(title, url, lead),
            itemListJsonLd(title, url, list),
            breadcrumbJsonLd([
              { name: "BetGPT", href: "/" },
              { name: title, href: path },
            ]),
          ]),
        }}
      />

      <header className="hero-panel p-6 sm:p-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-4xl">
            <p className="eyebrow">Football en direct</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-5xl">{title}</h1>
            <p className="seo-answer mt-4 max-w-3xl text-base leading-relaxed text-mist sm:text-lg">{lead}</p>
            {liveStale ? (
              <p className="mt-3 rounded-[1rem] border border-clay/25 bg-clay/8 px-4 py-3 text-sm text-mist">
                La dernière collecte a {fresh.ageSec != null ? `${fresh.ageSec} s` : "un âge inconnu"}. Les matchs encore marqués en cours affichent le dernier score connu, pas un direct confirmé à la seconde.
              </p>
            ) : null}
          </div>

          <div className="grid min-w-[280px] grid-cols-2 gap-3">
            <ScoreKpi label="En direct" value={String(liveNow.length)} />
            <ScoreKpi label="Matchs suivis" value={String(data.matches.length)} />
          </div>
        </div>

        <nav aria-label="Raccourcis scores" className="mt-6 flex flex-wrap gap-2 text-sm">
          <a href="/resultats-football" className="chip-pill hover:border-sage/30 hover:text-link">Résultats football</a>
          <Link to="/pronos-football" className="chip-pill hover:border-sage/30 hover:text-link">Pronostics football</Link>
          <Link to="/classement" className="chip-pill hover:border-sage/30 hover:text-link">Classements</Link>
          {leagues.map((id) => {
            const serp = competitionByLeague(id);
            const h = hubByLeague(id);
            return (
              <a key={id} href={serp?.scoresPath ?? h.path} className="chip-pill hover:border-sage/30 hover:text-link">
                {serp?.title ?? h.title}
              </a>
            );
          })}
        </nav>
      </header>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Vue rapide</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">Tous les matchs</h2>
          </div>
          <span className="chip-pill">Heure de Paris</span>
        </div>

        <div className="surface-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <caption className="sr-only">{title}</caption>
              <thead className="bg-slate-50/90 text-xs uppercase tracking-[0.14em] text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Heure</th>
                  <th className="px-4 py-3 font-semibold">Match</th>
                  <th className="px-4 py-3 font-semibold">Score</th>
                  <th className="px-4 py-3 font-semibold">Statut</th>
                </tr>
              </thead>
              <tbody>
                {ordered.slice(0, 40).map((m) => {
                  const status = strictStatus(m);
                  const showScore = hasScore(m) && status !== "SCHEDULED";
                  return (
                    <tr key={m.id} className="border-t border-line transition-colors hover:bg-slate-50/70">
                      <td className="px-4 py-4 tabular text-mist">{parisTime(m.kickoff) || "—"}</td>
                      <td className="px-4 py-4">
                        <a href={matchPath(m)} className="block font-semibold text-paper hover:text-link">
                          <TeamLine
                            home={m.home}
                            away={m.away}
                            league={m.league}
                            competition={m.competition}
                            size={24}
                            names="auto"
                          />
                        </a>
                        <span className="mt-1 block text-xs text-muted">{m.competition}</span>
                      </td>
                      <td className="px-4 py-4 text-xl font-bold tabular tracking-tight text-paper">{showScore ? `${m.scoreHome}–${m.scoreAway}` : "—"}</td>
                      <td className="px-4 py-4 text-mist">
                        <span className="chip-pill min-h-0 py-1">
                          {statusLabel(status, liveStale)}
                          {m.clock && (status === "LIVE" || status === "HALFTIME") ? ` · ${m.clock}` : ""}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <p className="eyebrow">Fiches match</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">Analyse rapide par rencontre</h2>
        </div>
        <ul className="grid gap-4 xl:grid-cols-2">
          {ordered.map((m) => {
            const p = byId.get(m.id);
            const pick = p ? betMarket(p.markets) : null;
            return (
              <li key={m.id} className="surface-card p-5 sm:p-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <Crest name={m.home.name} short={m.home.short} logo={m.home.logo} color={m.home.color} id={m.home.id} size={34} />
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-paper sm:text-lg">
                        <a href={matchPath(m)} className="hover:text-link">
                          {m.status === "live"
                            ? liveStale
                              ? `${m.home.name} – ${m.away.name} : dernier score connu`
                              : `${m.home.name} – ${m.away.name} en direct`
                            : m.status === "finished"
                              ? `Résultat ${m.home.name} – ${m.away.name}`
                              : `${m.home.name} – ${m.away.name}`}
                        </a>
                      </h3>
                      <p className="mt-1 text-xs text-muted">{m.competition}</p>
                    </div>
                    <Crest name={m.away.name} short={m.away.short} logo={m.away.logo} color={m.away.color} id={m.away.id} size={34} />
                  </div>
                  <LiveScore match={m} size="sm" stale={liveStale && m.status === "live"} />
                </div>

                <p className="mt-4 text-sm leading-relaxed text-mist">{p ? featuredAnswer(m, p) : featuredAnswer(m)}</p>

                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <a href={hubByLeague(m.league).path} className="chip-pill min-h-0 py-1 hover:text-link">{hubByLeague(m.league).title}</a>
                  <Link to="/equipe/$team" params={{ team: slugify(m.home.name) }} className="chip-pill min-h-0 py-1 hover:text-link">{m.home.name}</Link>
                  <Link to="/equipe/$team" params={{ team: slugify(m.away.name) }} className="chip-pill min-h-0 py-1 hover:text-link">{m.away.name}</Link>
                </div>

                {pick && p && !skipEuropeFrenchProno(p) ? (
                  <p className="mt-4 rounded-[1rem] border border-sage/20 bg-sage/8 px-4 py-3 text-sm font-medium text-paper">
                    Pari conseillé {pick.label} · {fmtOdds(pick.bestOdds)}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <CoconMesh {...mesh} />
    </div>
  );
}

function ScoreKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-card px-4 py-4 text-center">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className="mt-2 text-2xl font-bold tracking-tight text-paper">{value}</div>
    </div>
  );
}
