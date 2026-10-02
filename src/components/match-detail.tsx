import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import type { Absence, MatchInput, PredictionRecord } from "@/engine/types";
import type { TicketRow } from "@/engine/ticket-log";
import { publishedBeforeKickoff, verifyLabel, verifyStatus } from "@/engine/verify-core";
import { FR_BOOK_RE } from "@/engine/affiliates";
import { headlineMarket, matchPick, oddsPlayable, pronoVsStake } from "@/lib/markets";
import { skipEuropeFrenchProno } from "@/engine/french-clubs";
import { settlePick } from "@/lib/news";
import { explainMatch } from "@/lib/desk.functions";
import { AGENT_LABEL, MODEL_LABEL } from "@/lib/labels";
import { jsonLd, competitionPath, resultatRecap, datesFromVersions, matchPath, SITE_URL } from "@/lib/seo";
import { formatParis, matchClock } from "@/lib/match-clock";
import { recentLineLabel } from "@/engine/team-form";
import { ld } from "@/lib/ld";
import { compileArticle } from "@/engine/article";
import { MatchAdvanced, MatchArticleBody, MatchFaq, MatchVerdict } from "@/components/match-article";
import { BroadcastLinks } from "@/components/broadcaster-text";
import { matchBroadcast } from "@/lib/match-broadcasts";
import { MatchAnswer } from "@/components/match-answer";
import { LiveRecap } from "@/components/live-recap";
import { CoconMesh } from "@/components/cocon-mesh";
import { calendrierPath, classementPath, meshMatch } from "@/lib/cocon";
import { LiveSuperCard } from "@/components/live-super";
import { LivePrediction } from "@/components/live-prediction";
import { MatchIntelligencePanel } from "@/components/match-intelligence-panel";
import type { PredictionVersion } from "@/engine/intel-types";
import type { CuratedVideo } from "@/lib/serp/video";
import { scoreFreshness, strictStatus } from "@/lib/serp/status";
import { slugify } from "@/lib/programmatic";
import { useLiveRefresh } from "@/lib/live-refresh";
import { trackedUrl } from "@/lib/track";
import { bestThreeWay } from "@/lib/money";
import { fmtOdds, fmtPct } from "@/lib/utils";
import { BookLinks, PrimaryParier } from "./book-links";
import { CoverBet } from "./cover-bet";
import { Meter, ProbBar } from "./meters";
import {
  MatchBoard,
  PronoBanner,
  bookShort,
  formLetters,
  kickoffClock,
  kickoffDate,
  kickoffLong,
  matchPair,
  notrePronoLabel,
} from "./match-board";
import { SharePage } from "./share-page";
import { Button } from "./ui/button";
import { Badge, DecisionBadge, PremiumBadge, VerdictBadge } from "./ui/badge";

const TABS = [
  { id: "pronostics", label: "Pronostics" },
  { id: "cotes", label: "Cotes" },
  { id: "live", label: "Live" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function MatchDetail({
  match,
  prediction,
  sisters = [],
  ticket = null,
  versions = [],
  liveAsOf = null,
  video = null,
}: {
  match: MatchInput;
  prediction: PredictionRecord;
  sisters?: MatchInput[];
  ticket?: TicketRow | null;
  versions?: PredictionVersion[];
  liveAsOf?: string | null;
  video?: CuratedVideo | null;
}) {
  const [tab, setTab] = useState<TabId>("pronostics");
  const best = headlineMarket(prediction.markets);
  const { split } = pronoVsStake(prediction.markets);
  const pick = matchPick(prediction.markets);
  const listed1x2 = prediction.markets.some((m) => m.group === "1X2" && m.listed && m.bestOdds >= 1.05);
  const mute = skipEuropeFrenchProno(match);
  const settled = settlePick(match, prediction);
  const pair = matchPair(match.home.name, match.away.name);
  const slug = match.slug ?? match.id;
  const article = compileArticle(match, prediction);
  const broadcast = matchBroadcast(match);
  const state = strictStatus(match);
  const stale = (state === "LIVE" || state === "HALFTIME") && scoreFreshness(liveAsOf).stale;
  const clock = matchClock({ kickoff: match.kickoff, predictionAt: prediction.timestamp, versions });
  useLiveRefresh(match.status === "live");

  return (
    <article className="space-y-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld(jsonLd(match, prediction, { ...datesFromVersions(versions, prediction.timestamp), video, scoreStale: stale })) }} />
      <header className="hero-panel p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="min-w-0 max-w-4xl break-words text-xl font-bold tracking-tight text-paper sm:text-3xl">{article.h1}</h1>
          <div className="flex flex-wrap items-center gap-2">
            {!mute && listed1x2 && best.premium ? <PremiumBadge /> : null}
            {match.status === "finished" && settled.verdict !== "aucun" ? (
              <VerdictBadge verdict={settled.verdict} />
            ) : mute || !listed1x2 || split ? null : (
              <DecisionBadge decision={best.decision} />
            )}
            {ticket ? (
              <Link
                to="/prediction/$predictionId"
                params={{ predictionId: ticket.id }}
                className="flex flex-wrap items-center gap-2"
              >
                <Badge tone={match.status === "live" ? "sage" : match.status === "finished" ? "mist" : match.status === "cancelled" ? "clay" : "mist"}>
                  {stale ? "Dernier score" : match.status === "live" ? "Live" : match.status === "finished" ? "Terminé" : match.status === "cancelled" ? "Annulé" : "À venir"}
                </Badge>
                <Badge tone={verifyStatus(ticket) === "verified" ? "sage" : verifyStatus(ticket) === "unverified" ? "rust" : "clay"}>
                  {publishedBeforeKickoff(ticket) ? "Publié avant coup d'envoi" : "Après coup d'envoi"}
                  {" · "}
                  {verifyLabel(verifyStatus(ticket))}
                </Badge>
              </Link>
            ) : null}
          </div>
        </div>

        <MatchAnswer match={match} liveAsOf={liveAsOf} video={video} />

        {broadcast ? (
          <div className="mt-5">
            <BroadcastLinks texts={[broadcast.label]} />
            <p className="mt-2 text-xs text-muted">
              Diffusion France vérifiée via{" "}
              <a href={broadcast.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-link underline underline-offset-2">
                {broadcast.sourceLabel}
              </a>
              {" · "}contrôlée le {formatParis(broadcast.verifiedAt)}.
            </p>
          </div>
        ) : null}

        <div className="mt-6 inline-flex flex-wrap gap-1 rounded-2xl border border-line bg-slate-100/80 p-1" data-nosnippet>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`min-h-11 px-4 text-sm font-semibold ${
                tab === t.id ? "rounded-xl bg-white text-paper shadow-sm" : "rounded-xl text-muted hover:bg-white/70 hover:text-paper"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-5">
          {!mute ? <MatchVerdict article={article} asOf={clock.modified} freshness={clock.freshnessLabel} /> : <p className="seo-answer text-sm leading-relaxed text-mist">{article.lead}</p>}
        </div>

        <div className="mt-6 rounded-[1.5rem] border border-line bg-white/85 p-4 sm:p-5">
          <MatchBoard match={match} prediction={prediction} size="md" stale={stale} />
        </div>

        <p className="mt-4 text-xs text-muted">
          Coup d’envoi le {kickoffDate(match.kickoff)} à {kickoffClock(match.kickoff)} (Paris).
          {clock.published
            ? ` Publié le ${formatParis(clock.published)}.`
            : " Date de publication non horodatée : le coup d’envoi n’est pas une date de publication."}
          {clock.modified && clock.modified !== clock.published ? ` Mis à jour le ${formatParis(clock.modified)}.` : ""}
          {` Fraîcheur : ${clock.freshnessLabel}.`}
          {" · "}
          <a href={competitionPath(match.league)} className="hover:text-sage">
            Pronostic {match.competition}
          </a>
          {match.oddsSource ? ` · Cotes ${match.oddsSource}` : ""}
        </p>
      </header>

      {match.status === "live" || match.status === "finished" ? <LiveRecap match={match} /> : null}
      {match.status === "live" && prediction.liveSuper ? <LiveSuperCard bet={prediction.liveSuper} /> : null}

      {tab === "pronostics" ? (
        <PronosticsTab match={match} prediction={prediction} article={article} mute={mute} versions={versions} />
      ) : null}
      {tab === "cotes" ? <CotesTab match={match} prediction={prediction} mute={mute} /> : null}
      {tab === "live" ? <LiveTab match={match} prediction={prediction} /> : null}

      {match.status === "finished" && tab !== "live" ? (
        <section className="section-card border-sage/25 p-5 sm:p-6">
          <h2 className="text-lg font-semibold tracking-tight">Résumé {pair} : score, buts et faits du match</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-paper">{resultatRecap(match, prediction)}</p>
        </section>
      ) : null}

      <CoconMesh {...meshMatch(match, sisters)} />

      <div data-nosnippet>
        <SharePage url={`${SITE_URL}${matchPath(match)}`} title={article.title} />
      </div>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-mist">
        <a href={competitionPath(match.league)} className="hover:text-sage" title={`Pronostic ${match.competition}`}>
          Pronostics {match.competition}
        </a>
        <Link to="/equipe/$team" params={{ team: slugify(match.home.name) }} className="hover:text-sage">
          Pronostic {match.home.name}
        </Link>
        <Link to="/equipe/$team" params={{ team: slugify(match.away.name) }} className="hover:text-sage">
          Pronostic {match.away.name}
        </Link>
        <a href={`/cotes/${slug}`} className="hover:text-sage">
          Cotes {pair}
        </a>
        <a href={classementPath(match.league)} className="hover:text-sage">
          Classement {match.competition}
        </a>
        <a href={calendrierPath(match.league)} className="hover:text-sage">
          Calendrier {match.competition}
        </a>
        <a href="/scores-en-direct" className="hover:text-sage">
          Scores en direct
        </a>
      </p>
    </article>
  );
}

function PronosticsTab({
  match,
  prediction,
  article,
  mute,
  versions = [],
}: {
  match: MatchInput;
  prediction: PredictionRecord;
  article: ReturnType<typeof compileArticle>;
  mute: boolean;
  versions?: PredictionVersion[];
}) {
  const { prono, stake, split } = pronoVsStake(prediction.markets);
  const pair = matchPair(match.home.name, match.away.name);
  const label = notrePronoLabel(match.home.name, match.away.name, prono.market);
  const ticket = stake ?? prono;
  const ticketLabel = notrePronoLabel(match.home.name, match.away.name, ticket.market);
  const listed1x2 = prediction.markets.some((m) => m.group === "1X2" && m.listed && m.bestOdds >= 1.05);

  return (
    <div className="space-y-6">
      {!mute ? <LivePrediction match={match} prediction={prediction} versions={versions} /> : null}
      {!mute ? <MatchIntelligencePanel match={match} prediction={prediction} /> : null}

      <MatchArticleBody article={article} />

      <section className="surface-card p-5 sm:p-6">
        <h2 className="text-lg font-semibold tracking-tight">Les meilleures cotes pour parier sur {pair}</h2>
        <p className="mt-1 text-xs text-muted">Comparatif 1N2 des books France listés. Pas de bonus inventé.</p>
        <OddsTable match={match} />
        <p className="mt-4">
          <a href={`/cotes/${match.slug ?? match.id}`} className="text-sm font-semibold text-sage hover:underline">
            Voir toutes les cotes {pair}
          </a>
        </p>
      </section>

      <FormSection match={match} />
      <CompoSection match={match} />
      <AbsencesSection match={match} />

      {!mute && listed1x2 ? (
        <section className="surface-card p-5 sm:p-6">
          <h2 className="text-lg font-semibold tracking-tight">Notre prono {pair}</h2>
          <p className="mt-3 text-sm leading-relaxed text-paper">
            {article.verdictLabel}. Notre pronostic {match.home.name} – {match.away.name} : {label}.
            {split && stake
              ? ` Mise value distincte : ${ticketLabel} @ ${fmtOdds(stake.bestOdds)} — pas le favori du modèle.`
              : ""}
          </p>
          <div className="mt-4">
            <PronoBanner match={match} prediction={prediction} />
          </div>
          {ticket.cover && ticket.decision === "BET" ? (
            <div className="mt-4">
              <CoverBet cover={ticket.cover} matchId={match.id} />
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {oddsPlayable(ticket.bestOdds) ? (
              <PrimaryParier
                links={prediction.bookLinks}
                matchId={match.id}
                book={ticket.bestBook}
                odds={ticket.bestOdds}
                pick={ticketLabel}
              />
            ) : null}
            {oddsPlayable(ticket.bestOdds) ? <BookLinks links={prediction.bookLinks} matchId={match.id} /> : null}
            <Link
              to="/chat"
              reloadDocument
              search={{ q: `Analyse ${match.home.name} contre ${match.away.name}. Qu'est-ce que tu en fais ?` }}
              className="text-sm text-mist underline-offset-4 hover:text-paper hover:underline"
            >
              En parler au chat
            </Link>
          </div>
        </section>
      ) : null}

      <MatchFaq article={article} />

      <MatchAdvanced article={article}>
        {!mute ? <AlgoBlock match={match} prediction={prediction} /> : null}
        {!mute ? <MarketsStrip match={match} prediction={prediction} /> : null}
        <DeskExtras match={match} prediction={prediction} />
        <BriefingButton match={match} prediction={prediction} />
      </MatchAdvanced>
    </div>
  );
}

function AlgoBlock({ match, prediction }: { match: MatchInput; prediction: PredictionRecord }) {
  const pair = matchPair(match.home.name, match.away.name);
  const h = prediction.markets.find((m) => m.market === "1X2_H");
  const d = prediction.markets.find((m) => m.market === "1X2_D");
  const a = prediction.markets.find((m) => m.market === "1X2_A");
  const over = prediction.markets.find((m) => m.market === "OU_25_O");
  const btts = prediction.markets.find((m) => m.market === "BTTS_Y");
  const lines = [
    h
      ? `L’algorithme BetGPT estime ${fmtPct(prediction.calibrated.home)} pour une victoire de ${match.home.name} contre ${match.away.name}${h.bestOdds >= 1.05 ? ` — cote ${fmtOdds(h.bestOdds)} chez ${bookShort(h.bestBook)}` : ""}.`
      : null,
    d
      ? `La probabilité selon BetGPT pour un match nul entre ${match.home.name} et ${match.away.name} est de ${fmtPct(prediction.calibrated.draw)}${d.bestOdds >= 1.05 ? ` — cote ${fmtOdds(d.bestOdds)} chez ${bookShort(d.bestBook)}` : ""}.`
      : null,
    a
      ? `Notre modèle donne ${fmtPct(prediction.calibrated.away)} de chances pour une victoire de ${match.away.name}${a.bestOdds >= 1.05 ? ` — cote ${fmtOdds(a.bestOdds)} chez ${bookShort(a.bestBook)}` : ""}.`
      : null,
  ].filter(Boolean) as string[];

  const rows = [
    h && h.bestOdds >= 1.05
      ? { label: `${match.home.name} gagne`, p: prediction.calibrated.home, odds: h.bestOdds, book: bookShort(h.bestBook) }
      : null,
    over && over.bestOdds >= 1.05
      ? { label: "Plus de 2,5 buts", p: prediction.calibrated.over25, odds: over.bestOdds, book: bookShort(over.bestBook) }
      : null,
    btts && btts.bestOdds >= 1.05
      ? { label: "Les deux équipes marquent", p: prediction.calibrated.bttsYes, odds: btts.bestOdds, book: bookShort(btts.bestBook) }
      : null,
    a && a.bestOdds >= 1.05
      ? { label: `${match.away.name} gagne`, p: prediction.calibrated.away, odds: a.bestOdds, book: bookShort(a.bestBook) }
      : null,
  ].filter(Boolean) as { label: string; p: number; odds: number; book: string }[];

  return (
    <section className="surface-card p-5 sm:p-6">
      <h2 className="text-lg font-semibold tracking-tight">Probabilités selon notre algorithme — {pair}</h2>
      <p className="mt-1 text-xs text-muted">
        Modèle interne BetGPT, cotes listées chez les books France uniquement. Aucune cote n’est inventée.
      </p>
      <ul className="mt-3 space-y-2 text-sm leading-relaxed text-paper">
        {lines.map((l) => (
          <li key={l}>— {l}</li>
        ))}
      </ul>
      {rows.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wider text-muted">
              <tr className="border-b border-line">
                <th className="py-2 pr-3 font-medium">Pronostic {pair}</th>
                <th className="px-3 py-2 font-medium">Probabilité</th>
                <th className="px-3 py-2 font-medium">Cotes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-b border-line/70">
                  <td className="py-2.5 pr-3 text-paper">{r.label}</td>
                  <td className="px-3 py-2.5 tabular">{fmtPct(r.p)}</td>
                  <td className="px-3 py-2.5 tabular">
                    {fmtOdds(r.odds)} chez {r.book}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function MarketsStrip({ match, prediction }: { match: MatchInput; prediction: PredictionRecord }) {
  const { prono, stake } = pronoVsStake(prediction.markets);
  const listed = prediction.markets.filter((m) => m.listed && m.bestOdds >= 1.05).slice(0, 8);
  if (!listed.length) return null;
  return (
    <section className="surface-card overflow-x-auto">
      <h2 className="px-5 pt-5 text-lg font-semibold tracking-tight">
        {matchPair(match.home.name, match.away.name)} — pronostic et meilleures cotes
      </h2>
      <table className="mt-2 w-full min-w-[640px] text-sm">
        <thead className="text-left text-[11px] uppercase tracking-wider text-muted">
          <tr className="border-b border-line">
            <th className="px-5 py-2 font-medium">Marché</th>
            <th className="px-3 py-2 font-medium">Probabilité</th>
            <th className="px-3 py-2 font-medium">Cote</th>
            <th className="px-3 py-2 font-medium">Book</th>
            <th className="px-3 py-2 font-medium">Décision</th>
          </tr>
        </thead>
        <tbody>
          {listed.map((m) => (
            <tr
              key={m.market}
              className={`border-b border-line/60 ${m.market === prono.market ? "bg-sage/10" : m.market === stake?.market ? "bg-clay/10" : ""}`}
            >
              <td className="px-5 py-3 text-paper">
                {notrePronoLabel(match.home.name, match.away.name, m.market) === m.market
                  ? m.label
                  : notrePronoLabel(match.home.name, match.away.name, m.market)}
              </td>
              <td className="px-3 py-3 tabular">{fmtPct(m.modelProb)}</td>
              <td className="px-3 py-3 tabular">{fmtOdds(m.bestOdds)}</td>
              <td className="px-3 py-3">{bookShort(m.bestBook)}</td>
              <td className="px-3 py-3">
                <DecisionBadge decision={m.decision} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function FormSection({ match }: { match: MatchInput }) {
  return (
    <section className="surface-card p-5 sm:p-6">
      <h2 className="text-lg font-semibold tracking-tight">
        L’état de forme de {match.home.name} et {match.away.name}
      </h2>
      <p className="mt-1 text-xs text-muted">
        Cinq derniers scores ESPN terminés avant ce match, du plus récent au plus ancien. Aucun score n’est inventé.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <FormCard name={match.home.name} form={match.formHome} recent={match.recentHome} />
        <FormCard name={match.away.name} form={match.formAway} recent={match.recentAway} />
      </div>
    </section>
  );
}

function FormCard({
  name,
  form,
  recent = [],
}: {
  name: string;
  form?: string;
  recent?: { kickoff: string; opponent: string; scoreFor: number; scoreAgainst: number; venue: "home" | "away"; competition: string }[];
}) {
  const letters = formLetters(form);
  const n = letters.length;
  const w = letters.filter((l) => l === "W").length;
  const d = letters.filter((l) => l === "D").length;
  const l = letters.filter((l) => l === "L").length;
  return (
    <div className="rounded-md border border-line bg-pitch p-4">
      <p className="font-semibold text-paper">{name}</p>
      {n ? (
        <>
          <p className="mt-2 text-[11px] text-muted">Dernier match à gauche.</p>
          <div className="mt-2 flex gap-1">
            {letters.map((x, i) => (
              <span
                key={`${x}${i}`}
                className={
                  x === "W"
                    ? "grid size-7 place-items-center rounded-sm bg-sage text-xs font-bold text-ink"
                    : x === "L"
                      ? "grid size-7 place-items-center rounded-sm bg-rust text-xs font-bold text-on-header"
                      : "grid size-7 place-items-center rounded-sm bg-line text-xs font-bold text-muted"
                }
              >
                {x === "W" ? "V" : x === "L" ? "D" : "N"}
              </span>
            ))}
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <dt className="text-muted">Victoires</dt>
              <dd className="mt-0.5 font-semibold tabular text-paper">
                {w}/{n} ({Math.round((w / n) * 100)} %)
              </dd>
            </div>
            <div>
              <dt className="text-muted">Nuls</dt>
              <dd className="mt-0.5 font-semibold tabular text-paper">
                {d}/{n} ({Math.round((d / n) * 100)} %)
              </dd>
            </div>
            <div>
              <dt className="text-muted">Défaites</dt>
              <dd className="mt-0.5 font-semibold tabular text-paper">
                {l}/{n} ({Math.round((l / n) * 100)} %)
              </dd>
            </div>
          </dl>
          {recent.length ? (
            <ul className="mt-3 space-y-1 text-xs text-mist">
              {recent.map((line) => (
                <li key={`${line.kickoff}-${line.opponent}`}>{recentLineLabel(line)}</li>
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        <p className="mt-2 text-sm text-mist">Forme récente non observée. Aucune série n’est inventée.</p>
      )}
    </div>
  );
}

function CompoSection({ match }: { match: MatchInput }) {
  return (
    <section className="surface-card p-5 sm:p-6">
      <h2 className="text-lg font-semibold tracking-tight">
        Composition {matchPair(match.home.name, match.away.name)}
      </h2>
      <p className="mt-1 text-xs text-muted">Schémas listés. Les noms de titulaires ne sont publiés que s’ils arrivent du feed — ici, formation seulement.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-line bg-pitch px-4 py-4 text-center">
          <p className="text-sm font-semibold text-paper">{match.home.name}</p>
          <p className="mt-1 text-xs uppercase tracking-wider text-muted">Formation</p>
          <p className="mt-1 font-mono text-2xl font-bold tabular text-paper">{match.home.formation || "—"}</p>
        </div>
        <div className="rounded-md border border-line bg-pitch px-4 py-4 text-center">
          <p className="text-sm font-semibold text-paper">{match.away.name}</p>
          <p className="mt-1 text-xs uppercase tracking-wider text-muted">Formation</p>
          <p className="mt-1 font-mono text-2xl font-bold tabular text-paper">{match.away.formation || "—"}</p>
        </div>
      </div>
    </section>
  );
}

function AbsencesSection({ match }: { match: MatchInput }) {
  const home = match.absencesHome.value;
  const away = match.absencesAway.value;
  const unverified =
    match.absencesHome.confidence < 0.5 ||
    match.absencesAway.confidence < 0.5 ||
    /non branch|non observ|indisponible|unavailable/i.test(`${match.absencesHome.source} ${match.absencesAway.source}`);
  return (
    <section className="surface-card p-5 sm:p-6">
      <h2 className="text-lg font-semibold tracking-tight">Joueurs absents</h2>
      {!home.length && !away.length && unverified ? (
        <p className="mt-2 text-sm text-mist">Absences non vérifiées. Aucun nom n’est affiché tant qu’une liste fiable n’est pas branchée.</p>
      ) : null}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <AbsenceList name={match.home.name} items={home} unverified={unverified} />
        <AbsenceList name={match.away.name} items={away} unverified={unverified} />
      </div>
    </section>
  );
}

function AbsenceList({ name, items, unverified }: { name: string; items: Absence[]; unverified: boolean }) {
  return (
    <div>
      <p className="text-sm font-semibold text-paper">{name}</p>
      {items.length ? (
        <ul className="mt-2 space-y-1 text-sm text-mist">
          {items.map((a) => (
            <li key={`${a.player}-${a.reason}`}>
              {a.player}
              <span className="text-muted">
                {" "}
                · {a.role === "star" ? "cadre" : a.role === "starter" ? "titulaire" : "rotation"} ·{" "}
                {a.reason === "injury" ? "blessure" : a.reason === "suspension" ? "suspension" : "rotation"}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-mist">
          {unverified ? "Liste non vérifiée." : "Aucun forfait listé par la source."}
        </p>
      )}
    </div>
  );
}

function CotesTab({
  match,
  prediction,
  mute,
}: {
  match: MatchInput;
  prediction: PredictionRecord;
  mute: boolean;
}) {
  const pair = matchPair(match.home.name, match.away.name);
  const slug = match.slug ?? match.id;
  const best = bestThreeWay(match);
  return (
    <div className="space-y-6">
      <section className="surface-card p-5 sm:p-6">
        <h2 className="text-lg font-semibold tracking-tight">Les meilleures cotes pour parier sur {pair}</h2>
        {best ? (
          <p className="mt-2 text-sm text-mist">
            Meilleur 1 {fmtOdds(best.home.odds)} ({bookShort(best.home.book)}) · Nul {fmtOdds(best.draw.odds)} (
            {bookShort(best.draw.book)}) · 2 {fmtOdds(best.away.odds)} ({bookShort(best.away.book)}). Books France
            listés seulement.
          </p>
        ) : (
          <p className="mt-2 text-sm text-mist">Cotes en cours de collecte chez Unibet, Betclic et NetBet.</p>
        )}
        <OddsTable match={match} />
        <p className="mt-4">
          <a href={`/cotes/${slug}`} className="text-sm font-semibold text-sage hover:underline">
            Voir toutes les cotes {pair}
          </a>
        </p>
      </section>
      {mute ? null : (
        <div className="flex flex-wrap items-center gap-3">
          {oddsPlayable(matchPick(prediction.markets).bestOdds) ? (
            <PrimaryParier
              links={prediction.bookLinks}
              matchId={match.id}
              book={matchPick(prediction.markets).bestBook}
              odds={matchPick(prediction.markets).bestOdds}
              pick={notrePronoLabel(match.home.name, match.away.name, matchPick(prediction.markets).market)}
              label="Pariez maintenant"
            />
          ) : null}
          {oddsPlayable(matchPick(prediction.markets).bestOdds) ? (
            <BookLinks links={prediction.bookLinks} matchId={match.id} />
          ) : null}
        </div>
      )}
    </div>
  );
}

function OddsTable({ match }: { match: MatchInput }) {
  const books = match.current.filter((b) => FR_BOOK_RE.test(b.book) && b.home >= 1.05);
  if (!books.length) {
    return (
      <p className="mt-4 text-sm text-mist">
        {match.status === "live" || match.status === "finished"
          ? "Cotes 1X2 live non utilisées. On n’affiche que les cotes listées d’avant-match."
          : "Aucune cote France listée pour ce match."}
      </p>
    );
  }
  const maxH = Math.max(...books.map((b) => b.home));
  const maxD = Math.max(...books.map((b) => b.draw));
  const maxA = Math.max(...books.map((b) => b.away));
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[480px] text-sm">
        <thead className="text-left text-[11px] uppercase tracking-wider text-muted">
          <tr className="border-b border-line">
            <th className="py-2 pr-3 font-medium">Bookmaker</th>
            <th className="px-3 py-2 font-medium">1</th>
            <th className="px-3 py-2 font-medium">X</th>
            <th className="px-3 py-2 font-medium">2</th>
            <th className="px-3 py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {books.map((b) => (
            <tr key={b.book} className="border-b border-line/60">
              <td className="py-3 pr-3 font-medium text-paper">{bookShort(b.book)}</td>
              <td className={`px-3 py-3 tabular ${b.home === maxH ? "font-bold text-sage" : ""}`}>{fmtOdds(b.home)}</td>
              <td className={`px-3 py-3 tabular ${b.draw === maxD ? "font-bold text-sage" : ""}`}>{fmtOdds(b.draw)}</td>
              <td className={`px-3 py-3 tabular ${b.away === maxA ? "font-bold text-sage" : ""}`}>{fmtOdds(b.away)}</td>
              <td className="px-3 py-3">
                {b.url ? (
                  <a
                    href={trackedUrl(b.book, b.url, match.id)}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                    className="text-xs font-semibold text-sage hover:underline"
                  >
                    Parier
                  </a>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LiveTab({ match, prediction }: { match: MatchInput; prediction: PredictionRecord }) {
  const pair = matchPair(match.home.name, match.away.name);
  return (
    <div className="space-y-6">
      {match.status === "live" || match.status === "finished" ? <LiveRecap match={match} /> : null}
      {match.status === "live" && prediction.liveSuper ? <LiveSuperCard bet={prediction.liveSuper} /> : null}
      {match.status === "scheduled" ? (
        <section className="surface-card p-5 sm:p-6">
          <h2 className="text-lg font-semibold tracking-tight">Live {pair}</h2>
          <p className="mt-2 text-sm leading-relaxed text-paper">
            Coup d’envoi{" "}
            <time dateTime={match.kickoff}>
              {kickoffLong(match.kickoff)} à {kickoffClock(match.kickoff)}
            </time>
            , {match.venue}. Le score en direct s’affichera ici dès le coup d’envoi.
          </p>
        </section>
      ) : null}
      {match.status === "finished" ? (
        <section className="section-card border-sage/25 p-5 sm:p-6">
          <h2 className="text-lg font-semibold tracking-tight">Résumé {pair} : score, buts et faits du match</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-paper">{resultatRecap(match, prediction)}</p>
        </section>
      ) : null}
    </div>
  );
}

function BriefingButton({ match, prediction }: { match: MatchInput; prediction: PredictionRecord }) {
  const explain = useServerFn(explainMatch);
  const [text, setText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const best = headlineMarket(prediction.markets);
  return (
    <div className="mt-4">
      <Button
        variant="ghost"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr(null);
          const res = await explain({ data: { matchId: match.id, market: best.market } });
          setBusy(false);
          if (!res.ok) setErr(res.error);
          else setText(res.text);
        }}
      >
        {busy ? "Autre briefing…" : "Autre briefing"}
      </Button>
      {err ? <p className="mt-2 text-sm text-rust">{err}</p> : null}
      {text ? (
        <div className="mt-3 rounded-md border border-line p-4 text-sm leading-relaxed text-mist whitespace-pre-wrap">{text}</div>
      ) : null}
    </div>
  );
}

function DeskExtras({ match, prediction }: { match: MatchInput; prediction: PredictionRecord }) {
  const [open, setOpen] = useState<"chiffres" | "lecture" | "scenarios" | "trace" | null>(null);
  return (
    <section className="surface-card p-5">
      <h2 className="text-lg font-semibold tracking-tight">Lecture du desk</h2>
      <p className="mt-1 text-xs text-muted">Modèles, coaches et trace — pour qui veut le détail du calcul.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {(
          [
            ["chiffres", "Chiffres"],
            ["lecture", "Lecture"],
            ["scenarios", "Si ça bascule"],
            ["trace", "Trace"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setOpen(open === id ? null : id)}
            className={`min-h-10 rounded-md px-3 text-sm font-medium ${open === id ? "bg-sage text-ink" : "border border-line text-mist hover:text-paper"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mt-4">
        {open === "chiffres" ? <Models prediction={prediction} /> : null}
        {open === "lecture" ? <Coach prediction={prediction} /> : null}
        {open === "scenarios" ? <Scenarios prediction={prediction} /> : null}
        {open === "trace" ? <Audit match={match} prediction={prediction} /> : null}
      </div>
    </section>
  );
}

function Models({ prediction }: { prediction: PredictionRecord }) {
  return (
    <div className="overflow-x-auto rounded-md border border-line">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="text-left text-xs uppercase tracking-wider text-muted">
          <tr className="border-b border-line">
            <th className="px-4 py-3 font-medium">Modèle</th>
            <th className="px-3 py-3 font-medium">1</th>
            <th className="px-3 py-3 font-medium">X</th>
            <th className="px-3 py-3 font-medium">2</th>
            <th className="px-3 py-3 font-medium">+2,5</th>
            <th className="px-3 py-3 font-medium">Les deux marquent</th>
            <th className="px-3 py-3 font-medium">Buts prévus</th>
          </tr>
        </thead>
        <tbody>
          {prediction.models.map((m) => (
            <tr key={m.model} className="border-b border-line/70">
              <td className="px-4 py-3 text-paper">{MODEL_LABEL[m.model] ?? m.model}</td>
              <td className="px-3 py-3 tabular">{fmtPct(m.home)}</td>
              <td className="px-3 py-3 tabular">{fmtPct(m.draw)}</td>
              <td className="px-3 py-3 tabular">{fmtPct(m.away)}</td>
              <td className="px-3 py-3 tabular">{fmtPct(m.over25)}</td>
              <td className="px-3 py-3 tabular">{fmtPct(m.bttsYes)}</td>
              <td className="px-3 py-3 tabular text-mist">
                {m.lambdaHome.toFixed(2)}–{m.lambdaAway.toFixed(2)}
              </td>
            </tr>
          ))}
          <tr className="bg-raised">
            <td className="px-4 py-3 text-paper">Synthèse</td>
            <td className="px-3 py-3 tabular">{fmtPct(prediction.ensemble.home)}</td>
            <td className="px-3 py-3 tabular">{fmtPct(prediction.ensemble.draw)}</td>
            <td className="px-3 py-3 tabular">{fmtPct(prediction.ensemble.away)}</td>
            <td className="px-3 py-3 tabular">{fmtPct(prediction.ensemble.over25)}</td>
            <td className="px-3 py-3 tabular">{fmtPct(prediction.ensemble.bttsYes)}</td>
            <td className="px-3 py-3 tabular text-mist">
              {prediction.ensemble.lambdaHome.toFixed(2)}–{prediction.ensemble.lambdaAway.toFixed(2)}
            </td>
          </tr>
          <tr>
            <td className="px-4 py-3 text-sage">Chiffres retenus</td>
            <td className="px-3 py-3 tabular text-sage">{fmtPct(prediction.calibrated.home)}</td>
            <td className="px-3 py-3 tabular text-sage">{fmtPct(prediction.calibrated.draw)}</td>
            <td className="px-3 py-3 tabular text-sage">{fmtPct(prediction.calibrated.away)}</td>
            <td className="px-3 py-3 tabular">{fmtPct(prediction.calibrated.over25)}</td>
            <td className="px-3 py-3 tabular">{fmtPct(prediction.calibrated.bttsYes)}</td>
            <td className="px-3 py-3 text-muted">{prediction.calibrated.method}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Coach({ prediction }: { prediction: PredictionRecord }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Meter label="Avantage domicile" value={prediction.consensus.home} tone="sage" />
        <Meter label="Désaccord staff" value={prediction.consensus.disagreement} tone="clay" />
        <Meter label="Conflit de lecture" value={prediction.consensus.conflictScore} tone="rust" />
      </div>
      <section className="rounded-md border border-line p-4">
        <h3 className="font-display text-lg">Ce qui peut mal tourner</h3>
        <p className="mt-2 text-sm text-paper">{prediction.devil.alternativeScenario}</p>
        <p className="mt-2 text-xs text-muted">Niveau de doute {Math.round(prediction.devil.predictionChallengeScore * 100)} / 100</p>
        <ul className="mt-3 space-y-1 text-sm text-mist">
          {prediction.devil.riskFactors.map((r) => (
            <li key={r}>— {r}</li>
          ))}
        </ul>
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        {prediction.coaches.map((c) => (
          <section key={c.agent} className="rounded-md border border-line p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-display text-lg">{AGENT_LABEL[c.agent].title}</h3>
                <p className="text-xs text-muted">{AGENT_LABEL[c.agent].brief}</p>
              </div>
              <Badge tone="mist">{fmtPct(c.weight, 0)}</Badge>
            </div>
            <div className="mt-3">
              <ProbBar home={c.marketImplications.home} draw={c.marketImplications.draw} away={c.marketImplications.away} />
            </div>
            <ul className="mt-3 space-y-2 text-sm text-mist">
              {c.keyReasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            {c.contradictions.length > 0 ? <p className="mt-2 text-xs text-clay">{c.contradictions.join(" ")}</p> : null}
            <div className="mt-3 flex gap-3 text-xs text-muted">
              <span>on est sûr {fmtPct(c.confidence)}</span>
              <span>infos {fmtPct(c.dataQuality)}</span>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function Scenarios({ prediction }: { prediction: PredictionRecord }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {prediction.scenarios.map((s) => (
        <section key={s.id} className="rounded-md border border-line p-4">
          <h3 className="font-display text-lg">{s.label}</h3>
          <p className="mt-1 text-sm text-mist">{s.description}</p>
          <div className="mt-3">
            <ProbBar home={s.home} draw={s.draw} away={s.away} />
          </div>
          <div className="mt-2 flex gap-4 text-xs text-muted">
            <span>+2,5 buts {fmtPct(s.over25)}</span>
            <span>Les deux marquent {fmtPct(s.bttsYes)}</span>
          </div>
        </section>
      ))}
    </div>
  );
}

function Audit({ match, prediction }: { match: MatchInput; prediction: PredictionRecord }) {
  return (
    <section className="space-y-3 text-sm">
      <Row k="Version" v={prediction.engineVersion} />
      <Row k="Lecture" v={prediction.tacticalVersion} />
      <Row k="Réglage" v={prediction.calibrated.version} />
      <Row k="Heure" v={prediction.timestamp} />
      <Row
        k="Poids agents"
        v={prediction.coaches.map((c) => `${AGENT_LABEL[c.agent].title.split(" ")[0]} ${fmtPct(c.weight, 0)}`).join(" · ")}
      />
      <Row k="Info disponible" v={prediction.availableInformation.join(" · ")} />
      <div className="pt-2">
        <p className="text-xs uppercase tracking-widest text-muted">Détail des lectures</p>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {prediction.features.map((f) => (
            <li key={f.key} className="rounded-md bg-raised px-3 py-2">
              <div className="text-xs text-muted">{f.key}</div>
              <div className="tabular text-paper">
                {f.value.toFixed(2)} · conf {fmtPct(f.confidence, 0)} · {f.source}
              </div>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-xs text-muted">
        Chaque champ d'entrée porte source, horodatage, confiance et fraîcheur. Rien n'est inventé hors de cette feuille.
        Les cotes sont un carnet interne multi-books, pas un flux live.
      </p>
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-muted">{k}</span>
      <span className="text-right text-paper">{v}</span>
    </div>
  );
}
