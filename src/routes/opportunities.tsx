import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import type { Decision, LeagueId, MarketQuote, MatchInput, PredictionRecord } from "@/engine/types";
import { getPublicDesk } from "@/lib/desk.functions";
import { DECISION_LABEL, LEAGUE_LABEL } from "@/lib/labels";
import { valueExplain, valueLine } from "@/lib/plain";
import { fmtOdds, fmtPct, fmtSignedPct } from "@/lib/utils";
import { DecisionBadge, PremiumBadge } from "@/components/ui/badge";
import { BookLinks, PrimaryParier } from "@/components/book-links";
import { CoverBet } from "@/components/cover-bet";
import { BookMark, Crest } from "@/components/crest";
import { LiveScore } from "@/components/live-score";
import { MatchCard } from "@/components/match-card";
import { formatMatchHeadline } from "@/components/match-board";
import { useLiveRefresh } from "@/lib/live-refresh";
import { CoconMesh } from "@/components/cocon-mesh";
import { meshHub } from "@/lib/cocon";
import { SITE_URL } from "@/lib/seo";
import { skipEuropeFrenchProno } from "@/engine/french-clubs";
import { betMarket, headlineMarket, matchPick, oddsPlayable } from "@/lib/markets";

export const Route = createFileRoute("/opportunities")({
  loader: () => getPublicDesk(),
  staleTime: 0,
  head: () => ({
    meta: [
      { title: "Value bets football : meilleures cotes et pronostics | BetGPT" },
      {
        name: "description",
        content:
          "Paris football : value bets, meilleures cotes FR, pronostics BetGPT. Ligue 1, C1, Ligue Europa. Source betgpt.live.",
      },
      { property: "og:url", content: `${SITE_URL}/opportunities` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/opportunities` }],
  }),
  component: OpportunitiesPage,
});

function parisDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
}

function todayParis(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
}

function kickoffLabel(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });
}

function leagueTonightRank(league: LeagueId): number {
  if (league === "CL") return 0;
  if (league === "EL") return 1;
  return 2;
}

function dayBucket(kickoff: string, status?: string): number {
  if (status === "live") return 0;
  if (status === "finished") return 3;
  if (parisDay(kickoff) === todayParis()) return 1;
  return 2;
}

function OpportunitiesPage() {
  const data = Route.useLoaderData();
  const [filter, setFilter] = useState<Decision | "ALL" | "PREMIUM" | "TONIGHT">("TONIGHT");
  const byId = useMemo(() => new Map(data.matches.map((m) => [m.id, m])), [data.matches]);
  const list = useMemo(
    () =>
      data.predictions
        .filter((p) => !skipEuropeFrenchProno(p))
        .map((p) => ({ p, m: matchPick(p.markets) }))
        .filter((x) => oddsPlayable(x.m.bestOdds))
        .sort((a, b) => {
          const ma = byId.get(a.p.matchId);
          const mb = byId.get(b.p.matchId);
          const da = dayBucket(a.p.kickoff, ma?.status);
          const db = dayBucket(b.p.kickoff, mb?.status);
          if (da !== db) return da - db;
          if (da === 1) {
            const lr = leagueTonightRank(a.p.league) - leagueTonightRank(b.p.league);
            if (lr !== 0) return lr;
            const ko = a.p.kickoff.localeCompare(b.p.kickoff);
            if (ko !== 0) return ko;
          } else if (da === 2) {
            const ko = a.p.kickoff.localeCompare(b.p.kickoff);
            if (ko !== 0) return ko;
          } else if (da === 3) {
            const ko = b.p.kickoff.localeCompare(a.p.kickoff);
            if (ko !== 0) return ko;
          }
          if (a.m.premium && !b.m.premium) return -1;
          if (!a.m.premium && b.m.premium) return 1;
          if (a.m.clPhaseBest && !b.m.clPhaseBest) return -1;
          if (!a.m.clPhaseBest && b.m.clPhaseBest) return 1;
          if (a.m.elPhaseBest && !b.m.elPhaseBest) return -1;
          if (!a.m.elPhaseBest && b.m.elPhaseBest) return 1;
          const rank = (d: Decision) => (d === "BET" ? 0 : d === "WATCH" ? 1 : 2);
          const dr = rank(a.m.decision) - rank(b.m.decision);
          if (dr !== 0) return dr;
          if (a.p.matchId === b.p.matchId) {
            const ha = headlineMarket(a.p.markets);
            if (a.m.market === ha.market && b.m.market !== ha.market) return -1;
            if (b.m.market === ha.market && a.m.market !== ha.market) return 1;
          }
          return b.m.stakePct - a.m.stakePct || b.m.opportunityScore - a.m.opportunityScore;
        }),
    [data.predictions, byId],
  );
  const tonightMatches = useMemo(() => {
    const today = todayParis();
    const seen = new Set<string>();
    const out: { p: PredictionRecord; match?: MatchInput }[] = [];
    for (const p of data.predictions) {
      if (skipEuropeFrenchProno(p)) continue;
      if (seen.has(p.matchId)) continue;
      const match = byId.get(p.matchId);
      if (match?.status === "finished") continue;
      if (parisDay(p.kickoff) !== today && match?.status !== "live") continue;
      seen.add(p.matchId);
      out.push({ p, match });
    }
    return out;
  }, [data.predictions, byId]);
  const counts = useMemo(() => {
    const c = { ALL: 0, BET: 0, WATCH: 0, NO_BET: 0, PREMIUM: 0, TONIGHT: 0 };
    for (const x of list) {
      const match = byId.get(x.p.matchId);
      if (match?.status === "finished") continue;
      c.ALL += 1;
      c[x.m.decision] += 1;
      if (x.m.premium) c.PREMIUM += 1;
      if (match?.status === "live" || parisDay(x.p.kickoff) === todayParis()) c.TONIGHT += 1;
    }
    return c;
  }, [list, byId]);
  const openMatchCount = useMemo(
    () => data.matches.filter((m) => m.status !== "finished").length,
    [data.matches],
  );
  const tonightBets = useMemo(
    () => tonightMatches.filter((x) => Boolean(betMarket(x.p.markets))).length,
    [tonightMatches],
  );
  const activeFilter = filter === "TONIGHT" && tonightMatches.length === 0 ? "ALL" : filter;
  const openList = list.filter((x) => byId.get(x.p.matchId)?.status !== "finished");
  const rows =
    activeFilter === "ALL"
      ? openList
      : activeFilter === "PREMIUM"
        ? openList.filter((x) => x.m.premium)
        : activeFilter === "TONIGHT"
          ? openList.filter((x) => {
              const match = byId.get(x.p.matchId);
              return match?.status === "live" || parisDay(x.p.kickoff) === todayParis();
            })
          : openList.filter((x) => x.m.decision === activeFilter);
  useLiveRefresh(data.matches.some((m) => m.status === "live"));

  return (
    <div className="space-y-8">
      <section className="hero-panel p-6 sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div>
            <p className="eyebrow">Opportunités</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">
              Value bets et paris football
            </h1>
            <p className="seo-answer mt-4 max-w-3xl text-base leading-relaxed text-mist sm:text-lg">
              {tonightMatches.length
                ? `Ce soir : ${tonightMatches.length} matchs${
                    tonightMatches.some((x) => x.p.league === "CL")
                      ? ` dont ${tonightMatches.filter((x) => x.p.league === "CL").length} C1`
                      : ""
                  }. ${tonightBets} ticket${tonightBets > 1 ? "s" : ""} à miser. `
                : ""}
              {openMatchCount} matchs à venir. {counts.BET} value bets ouverts.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="chip-pill">Ce soir · {tonightMatches.length}</span>
              <span className="chip-pill">Value bets · {counts.BET}</span>
              <span className="chip-pill">Premium · {counts.PREMIUM}</span>
            </div>
          </div>
          <aside className="surface-card p-5">
            <p className="text-sm font-semibold text-paper">Lecture rapide</p>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-mist">
              <li>• BET : écart suffisant et cote dans la plage jouable.</li>
              <li>• WATCH : signal intéressant mais marge encore trop fine.</li>
              <li>• NO BET : aucune raison suffisante de miser.</li>
            </ul>
          </aside>
        </div>
      </section>
      {tonightMatches.length > 0 ? (
        <section className="space-y-4">
          <div><p className="eyebrow">Sélection du jour</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">Ce soir</h2></div>
          <ul className="grid gap-4 lg:grid-cols-2">
            {tonightMatches.map(({ p, match }) => {
              if (match) {
                return (
                  <li key={p.matchId}>
                    <MatchCard match={match} prediction={p} />
                  </li>
                );
              }
              const pick = matchPick(p.markets);
              const playable = oddsPlayable(pick.bestOdds);
              return (
                <li key={p.matchId} className="surface-card p-4">
                  <Link to="/match/$matchId" params={{ matchId: p.matchId }} className="block">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-sage">
                      {LEAGUE_LABEL[p.league]} · {kickoffLabel(p.kickoff)}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-paper">
                      {p.home.name} – {p.away.name}
                    </p>
                    <p className="mt-2 text-sm text-paper">
                      {playable ? `${pick.label} · ${fmtOdds(pick.bestOdds)}` : "Pas de mise · hors fenêtre canonique 1,80–3,00"}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      {data.clPhaseBest ? (
        <ClPhaseCard
          competition="Ligue des champions"
          prediction={data.clPhaseBest.prediction}
          market={data.clPhaseBest.market}
          phaseLabel={data.clPhaseBest.phaseLabel}
        />
      ) : null}
      {data.elPhaseBest ? (
        <ClPhaseCard
          competition="Ligue Europa"
          prediction={data.elPhaseBest.prediction}
          market={data.elPhaseBest.market}
          phaseLabel={data.elPhaseBest.phaseLabel}
        />
      ) : null}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Ce soir" value={String(tonightMatches.length)} />
        <Kpi label="À jouer" value={String(tonightBets || counts.BET)} />
        <Kpi label="Premium" value={String(counts.PREMIUM)} />
        <Kpi label="À venir" value={String(openMatchCount)} />
      </section>
      <div className="surface-card flex flex-wrap gap-2 p-3">
        {(["TONIGHT", "ALL", "BET", "PREMIUM", "WATCH", "NO_BET"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={`min-h-10 rounded-full px-4 text-[13px] font-semibold transition-colors ${
              activeFilter === k ? "bg-sage text-ink shadow-[0_8px_18px_rgba(124,194,58,0.2)]" : "border border-line bg-white text-muted hover:text-paper"
            }`}
          >
            {k === "ALL" ? "Tous" : k === "PREMIUM" ? "Premium" : k === "TONIGHT" ? "Ce soir" : DECISION_LABEL[k]} ({k === "TONIGHT" ? tonightMatches.length : counts[k]})
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface px-4 py-8 text-center text-sm text-mist">
          {filter === "BET"
            ? "Aucune mise au-dessus du seuil pour l'instant. Ouvre Surveiller : ce sont les bords trop minces."
            : filter === "PREMIUM"
              ? "Pas de ticket premium sur cette fenêtre. Il en faut un domicile 1,85–2,65 vraiment trop payé."
              : filter === "TONIGHT"
                ? "Pas de match ce soir. Ouvre Tous pour la suite du calendrier."
                : "Rien dans ce filtre."}
        </p>
      ) : (
        <div className="section-card overflow-x-auto">
          <table className="w-full min-w-[1080px] text-sm">
            <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
              <tr className="border-b border-line">
                <th className="px-4 py-3 font-medium">Match</th>
                <th className="px-3 py-3 font-medium">Marché</th>
                <th className="px-3 py-3 font-medium">Cote</th>
                <th className="px-3 py-3 font-medium">Chance</th>
                <th className="px-3 py-3 font-medium">Écart</th>
                <th className="px-3 py-3 font-medium">Gain estimé</th>
                <th className="px-3 py-3 font-medium">Mise</th>
                <th className="px-3 py-3 font-medium">Couverture 50%</th>
                <th className="px-3 py-3 font-medium">Décision</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ p, m }) => {
                const match = byId.get(p.matchId);
                const tonight = match?.status === "live" || parisDay(p.kickoff) === todayParis();
                return (
                <tr key={`${p.matchId}-${m.market}`} className={`border-b border-line/60 hover:bg-raised/80 ${m.premium ? "bg-sage/5" : ""} ${tonight ? "bg-sage/10" : ""}`}>
                  <td className="px-4 py-3">
                    <Link
                      to="/match/$matchId"
                      params={{ matchId: match?.slug ?? p.matchId }}
                      className="flex items-center gap-2 text-paper hover:text-sage"
                    >
                      <Crest name={p.home.name} short={p.home.short} logo={p.home.logo} color={p.home.color} id={p.home.id} size={28} />
                      <span>
                        {p.home.short}–{p.away.short}
                      </span>
                      <Crest name={p.away.name} short={p.away.short} logo={p.away.logo} color={p.away.color} id={p.away.id} size={28} />
                    </Link>
                    <div className="text-xs text-muted">
                      {tonight ? <span className="font-semibold text-sage">Ce soir · </span> : null}
                      {kickoffLabel(p.kickoff)} · {p.competition}
                      {m.premium ? " · Premium" : ""}
                      {m.clPhaseBest ? " · meilleure C1 de la phase" : ""}
                      {m.elPhaseBest ? " · meilleure Ligue Europa de la phase" : ""}
                    </div>
                    {match ? <div className="mt-1"><LiveScore match={match} size="sm" /></div> : null}
                  </td>
                  <td className="px-3 py-3">{m.label}</td>
                  <td className="px-3 py-3 tabular">
                    <span className="inline-flex items-center gap-1.5">
                      <BookMark book={m.bestBook} />
                      {fmtOdds(m.bestOdds)}
                    </span>
                    <div className="text-xs text-muted">{m.bestBook.replace(/\s·\s.*$/, "")}</div>
                    <div className="mt-1 text-[11px] leading-snug text-muted">{valueLine(m)}</div>
                    <div className="mt-1">
                      <PrimaryParier
                        links={p.bookLinks}
                        matchId={p.matchId}
                        book={m.bestBook}
                        odds={m.bestOdds}
                        pick={m.label.replace("1 — Domicile", "1").replace("2 — Extérieur", "2").replace("X — Nul", "N")}
                      />
                    </div>
                    <div className="mt-1">
                      <BookLinks links={p.bookLinks} compact matchId={p.matchId} />
                    </div>
                  </td>
                  <td className="px-3 py-3 tabular">{fmtPct(m.modelProb)}</td>
                  <td className={`px-3 py-3 tabular ${m.edge > 0 ? "text-sage" : "text-rust"}`}>
                    {fmtSignedPct(m.edge)}
                  </td>
                  <td className={`px-3 py-3 tabular ${m.ev > 0 ? "text-sage" : "text-rust"}`}>
                    {fmtSignedPct(m.ev)}
                  </td>
                  <td className="px-3 py-3 tabular text-paper">
                    {m.decision === "BET" ? fmtPct(m.stakePct) : "—"}
                  </td>
                  <td className="px-3 py-3 min-w-[180px]">
                    {m.cover ? <CoverBet cover={m.cover} compact matchId={p.matchId} /> : "—"}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {m.premium ? <PremiumBadge /> : null}
                      <DecisionBadge decision={m.decision} />
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <CoconMesh {...meshHub("/opportunities", "Opportunités value", data.matches, "cote")} />
    </div>
  );
}

function ClPhaseCard({
  competition,
  prediction,
  market,
  phaseLabel,
}: {
  competition: string;
  prediction: PredictionRecord;
  market: MarketQuote;
  phaseLabel: string;
}) {
  return (
    <section className="section-card p-5 sm:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sage">
        {competition} · {phaseLabel}
        {market.premium ? " · Premium" : ""}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Crest name={prediction.home.name} short={prediction.home.short} logo={prediction.home.logo} color={prediction.home.color} id={prediction.home.id} size={36} />
        <h2 className="text-lg font-bold tracking-tight">
          {formatMatchHeadline({
            home: prediction.home.name,
            away: prediction.away.name,
            competition,
            kickoff: prediction.kickoff,
          })}
        </h2>
        <Crest name={prediction.away.name} short={prediction.away.short} logo={prediction.away.logo} color={prediction.away.color} id={prediction.away.id} size={36} />
      </div>
      <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm leading-relaxed text-mist">
        {valueExplain(prediction, market)}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <PrimaryParier
          links={prediction.bookLinks}
          matchId={prediction.matchId}
          book={market.bestBook}
          odds={market.bestOdds}
          pick={market.label}
        />
        <BookLinks links={prediction.bookLinks} matchId={prediction.matchId} />
        {market.cover ? <CoverBet cover={market.cover} compact matchId={prediction.matchId} /> : null}
      </div>
    </section>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-card px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-2 font-display text-2xl font-bold text-paper">{value}</p>
    </div>
  );
}