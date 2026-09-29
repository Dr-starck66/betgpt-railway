import { Link } from "@tanstack/react-router";
import { CalendarDays, ChartNoAxesColumnIncreasing, Radio, Trophy } from "lucide-react";
import { Crest, TeamLine } from "@/components/crest";
import { LiveScore } from "@/components/live-score";
import { BookLinks } from "@/components/book-links";
import type { LeagueId } from "@/engine/types";
import { getLeagueDesk } from "@/lib/desk.functions";
import { CoconMesh } from "@/components/cocon-mesh";
import { calendrierPath, classementPath, meshLeague, breadcrumbJsonLd } from "@/lib/cocon";
import { useLiveRefresh } from "@/lib/live-refresh";
import { collectionJsonLd, hubByLeague, itemListJsonLd, SITE_URL } from "@/lib/programmatic";
import { ld } from "@/lib/ld";
import { matchPath } from "@/lib/seo";
import { skipEuropeFrenchProno } from "@/engine/french-clubs";
import { CupNight } from "@/components/cup-night";
import { fmtOdds } from "@/lib/utils";
import { headlineMarket } from "@/lib/markets";

type Desk = Awaited<ReturnType<typeof getLeagueDesk>>;

export function CupPage({
  league,
  title,
  data,
}: {
  league: LeagueId;
  title: string;
  data: Desk;
}) {
  const matches = data.matches.filter((m) => m.league === league);
  const liveNow = matches.filter((m) => m.status === "live");
  const finished = matches.filter((m) => m.status === "finished").length;
  const upcoming = matches.filter((m) => m.status !== "finished").length;
  useLiveRefresh(liveNow.length > 0);
  const byId = new Map(data.predictions.map((p) => [p.matchId, p]));
  const phaseBest = league === "CL" ? data.clPhaseBest : league === "EL" ? data.elPhaseBest : null;
  const hub = hubByLeague(league);
  const url = `${SITE_URL}${hub.path}`;
  const list = matches.slice(0, 40).map((m) => ({
    name: `${m.home.name} – ${m.away.name} : pronostic et analyse du match`,
    url: `${SITE_URL}${matchPath(m)}`,
  }));

  return (
    <div className="space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: ld([
            collectionJsonLd(`${title} : pronostic et analyse`, url, `Pronostic, analyse et score en direct ${title}.`),
            itemListJsonLd(`Matchs ${title}`, url, list),
            breadcrumbJsonLd([
              { name: "BetGPT", href: "/" },
              { name: "Pronostics football", href: "/pronos-football" },
              { name: title, href: hub.path },
            ]),
          ]),
        }}
      />

      <section className="hero-panel p-6 sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div>
            <p className="eyebrow">Compétition</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">
              {title} : pronostics, scores et calendrier
            </h1>
            <p className="seo-answer mt-4 max-w-3xl text-base leading-relaxed text-mist sm:text-lg">
              Analyse de chaque match de {title}, score en direct, cotes et accès rapide au classement et au calendrier.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <a href="/scores-en-direct" className="chip-pill hover:border-sage/30 hover:text-link"><Radio size={15} />Scores en direct</a>
              <a href={classementPath(league)} className="chip-pill hover:border-sage/30 hover:text-link"><ChartNoAxesColumnIncreasing size={15} />Classement</a>
              <a href={calendrierPath(league)} className="chip-pill hover:border-sage/30 hover:text-link"><CalendarDays size={15} />Calendrier</a>
            </div>
          </div>
          <aside className="surface-card p-5">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-sage/12 text-link"><Trophy size={21} /></span>
              <div><p className="text-sm font-semibold text-paper">Vue compétition</p><p className="text-xs text-muted">Données disponibles dans le desk</p></div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2 text-center">
              <MiniKpi label="Matchs" value={String(matches.length)} />
              <MiniKpi label="Live" value={String(liveNow.length)} />
              <MiniKpi label="À venir" value={String(upcoming)} />
            </div>
            {finished ? <p className="mt-3 text-xs text-muted">{finished} rencontre{finished > 1 ? "s" : ""} déjà terminée{finished > 1 ? "s" : ""} dans la fenêtre affichée.</p> : null}
          </aside>
        </div>
      </section>

      {league === "CL" && data.review?.clNight ? <CupNight night={data.review.clNight} /> : null}
      <CoconMesh {...meshLeague(league, matches)} />

      {liveNow.length > 0 ? (
        <section className="section-card p-5 sm:p-6">
          <p className="eyebrow">Live</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">Matchs en direct</h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {liveNow.map((m) => (
              <li key={m.id}>
                <Link
                  to="/match/$matchId"
                  params={{ matchId: m.slug ?? m.id }}
                  className="surface-card flex h-full flex-wrap items-center justify-between gap-3 p-4 hover:border-sage/35"
                >
                  <TeamLine home={m.home} away={m.away} size={32} competition={m.competition} className="min-w-0 flex-1" />
                  <span className="shrink-0"><LiveScore match={m} size="sm" /></span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {phaseBest ? (
        <section className="section-card p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="eyebrow">Meilleure opportunité · {phaseBest.phaseLabel}</p>
              <h2 className="mt-2 text-xl font-semibold">
                <TeamLine
                  home={phaseBest.prediction.home}
                  away={phaseBest.prediction.away}
                  size={30}
                  names="full"
                  competition={phaseBest.prediction.competition}
                />
              </h2>
              <p className="mt-2 text-sm text-mist">
                {phaseBest.market.label} à {fmtOdds(phaseBest.market.bestOdds)} chez {phaseBest.market.bestBook.replace(/\s·\s.*$/, "")}
              </p>
            </div>
            <BookLinks links={phaseBest.prediction.bookLinks} matchId={phaseBest.prediction.matchId} />
          </div>
        </section>
      ) : null}

      <section className="section-card overflow-hidden">
        <div className="border-b border-line px-5 py-4 sm:px-6">
          <p className="eyebrow">Tous les matchs</p>
          <h2 className="mt-1 text-2xl font-semibold">Programme, score et lecture BetGPT</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
              <tr className="border-b border-line">
                <th className="px-5 py-3">Match</th>
                <th className="px-3 py-3">Score</th>
                <th className="px-3 py-3">Prono</th>
                <th className="px-3 py-3">Cote</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((m) => {
                const p = byId.get(m.id);
                const mute = skipEuropeFrenchProno(m);
                const bet = mute ? undefined : p?.markets.find((x) => x.decision === "BET");
                const pick = mute ? undefined : bet ?? (p ? headlineMarket(p.markets) : undefined);
                return (
                  <tr key={m.id} className="border-b border-line/60 transition-colors hover:bg-slate-50/80">
                    <td className="px-5 py-4">
                      <Link
                        to="/match/$matchId"
                        params={{ matchId: m.slug ?? m.id }}
                        className="flex items-center gap-2 font-medium text-paper hover:text-link"
                      >
                        <Crest name={m.home.name} short={m.home.short} logo={m.home.logo} color={m.home.color} id={m.home.id} size={26} />
                        <span>{m.home.name} – {m.away.name}</span>
                        <Crest name={m.away.name} short={m.away.short} logo={m.away.logo} color={m.away.color} id={m.away.id} size={26} />
                      </Link>
                    </td>
                    <td className="px-3 py-4"><LiveScore match={m} size="sm" /></td>
                    <td className="px-3 py-4">
                      {mute ? "Pas de prono" : pick ? (
                        <span>
                          {pick.label}
                          {bet ? <span className="ml-2 text-[11px] font-semibold uppercase text-link">Mise</span> : <span className="ml-2 text-[11px] uppercase text-muted">Surveiller</span>}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-4 tabular font-semibold">{pick ? fmtOdds(pick.bestOdds) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function MiniKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-slate-50 px-3 py-3">
      <div className="text-lg font-bold text-paper">{value}</div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</div>
    </div>
  );
}
