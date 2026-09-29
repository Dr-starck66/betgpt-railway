import type { LeagueId, MatchInput, PredictionRecord } from "@/engine/types";
import { FR_BOOK_RE } from "@/engine/affiliates";
import { skipEuropeFrenchProno } from "@/engine/french-clubs";
import { betMarket, oddsPlayable } from "@/lib/markets";
import { competitionPath } from "@/lib/seo";
import { teamPath } from "@/lib/programmatic";
import { trackedUrl } from "@/lib/track";
import { cn, fmtOdds, fmtPct } from "@/lib/utils";
import { Crest } from "./crest";
import { LiveScore } from "./live-score";

const PARIS = "Europe/Paris";

export function kickoffDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: PARIS,
  });
}

export function kickoffClock(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: PARIS,
  });
}

export function kickoffLong(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: PARIS,
  });
}

export function matchPair(home: string, away: string): string {
  return `${home} - ${away}`;
}

export function competitionRegion(league: LeagueId): string {
  if (league === "CL" || league === "EL") return "Europe";
  if (league === "L1") return "France";
  if (league === "PL") return "Angleterre";
  if (league === "LL") return "Espagne";
  if (league === "BL") return "Allemagne";
  if (league === "SA") return "Italie";
  if (league === "ER") return "Pays-Bas";
  if (league === "PT") return "Portugal";
  if (league === "SC") return "Écosse";
  if (league === "TR") return "Turquie";
  return "International";
}

export function formatMatchHeadline(opts: {
  home: string;
  away: string;
  competition: string;
  kickoff: string;
  status?: string;
}): string {
  const d = kickoffDate(opts.kickoff);
  const pair = matchPair(opts.home, opts.away);
  if (opts.status === "live") return `Score ${pair}, ${opts.competition} - ${d}`;
  if (opts.status === "finished") return `Résultat ${pair}, ${opts.competition} - ${d}`;
  return `Pronostic ${pair} : analyse et score probable`;
}

export function matchHeadline(match: MatchInput): string {
  return formatMatchHeadline({
    home: match.home.name,
    away: match.away.name,
    competition: match.competition,
    kickoff: match.kickoff,
    status: match.status,
  });
}

export function notrePronoLabel(home: string, away: string, market: string): string {
  if (market === "1X2_H") return `Victoire de ${home}`;
  if (market === "1X2_A") return `Victoire de ${away}`;
  if (market === "1X2_D") return "Match nul";
  if (market === "DC_1X") return `${home} ou Nul`;
  if (market === "DC_X2") return `${away} ou Nul`;
  if (market === "DC_12") return "Vainqueur (pas de nul)";
  if (market === "BTTS_Y") return "Les deux équipes marquent";
  if (market === "BTTS_N") return "Au moins une équipe ne marque pas";
  if (market === "OU_25_O") return "Plus de 2,5 buts";
  if (market === "OU_25_U") return "Moins de 2,5 buts";
  return market;
}

export function bookShort(book: string): string {
  return book.replace(/\s·\s.*$/, "").trim();
}

export function formLetters(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .toUpperCase()
    .replace(/[^WDL]/g, "")
    .slice(-6)
    .split("");
}

export function MatchBoard({
  match,
  prediction,
  size = "md",
  stale = false,
}: {
  match: MatchInput;
  prediction: PredictionRecord;
  size?: "md" | "lg";
  stale?: boolean;
}) {
  const mute = skipEuropeFrenchProno(match);
  const h = prediction.markets.find((m) => m.market === "1X2_H");
  const d = prediction.markets.find((m) => m.market === "1X2_D");
  const a = prediction.markets.find((m) => m.market === "1X2_A");
  const listed1x2 = [h, d, a].some((x) => Boolean(x?.listed && x.bestOdds >= 1.05));
  const advised = mute ? null : betMarket(prediction.markets);
  const crest = size === "lg" ? 88 : 56;
  const boxes = [
    {
      key: "1",
      market: "1X2_H",
      odds: listed1x2 ? h?.bestOdds : undefined,
      p: prediction.calibrated.home,
      name: match.home.short,
    },
    {
      key: "X",
      market: "1X2_D",
      odds: listed1x2 ? d?.bestOdds : undefined,
      p: prediction.calibrated.draw,
      name: "Nul",
    },
    {
      key: "2",
      market: "1X2_A",
      odds: listed1x2 ? a?.bestOdds : undefined,
      p: prediction.calibrated.away,
      name: match.away.short,
    },
  ] as const;
  const formH = size === "lg" ? formLetters(match.formHome) : [];
  const formA = size === "lg" ? formLetters(match.formAway) : [];
  const region = competitionRegion(match.league);
  const hotMarket = advised?.market;

  return (
    <div className="space-y-5">
      {size === "lg" ? (
        <p className="text-sm font-medium text-mist">
          <a
            href={competitionPath(match.league)}
            className="hover:text-sage"
            title={`Pronostic ${match.competition}`}
          >
            {region} - {match.competition}
          </a>
          {match.phaseLabel ? <span className="text-muted"> · {match.phaseLabel}</span> : null}
        </p>
      ) : (
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
          {match.competition}
        </p>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-8">
        <TeamSide
          name={match.home.name}
          short={match.home.short}
          logo={match.home.logo ?? prediction.home.logo}
          color={match.home.color}
          id={match.home.id}
          crest={crest}
          form={formH}
          href={size === "lg" ? teamPath(match.home.name) : undefined}
          competition={match.competition}
        />
        <div className="flex min-w-[5.5rem] flex-col items-center gap-1.5 sm:min-w-[7.5rem]">
          {match.status === "live" || match.status === "finished" ? (
            <LiveScore match={match} size={size === "lg" ? "lg" : "md"} stale={stale} />
          ) : (
            <>
              <p className="text-sm font-bold tabular text-paper sm:text-lg">
                {kickoffDate(match.kickoff)}
              </p>
              <p className="text-lg font-bold tabular tracking-tight text-paper sm:text-2xl">
                {kickoffClock(match.kickoff)}
              </p>
            </>
          )}
          {size === "lg" ? (
            <p className="hidden max-w-[14rem] text-center text-xs capitalize text-muted sm:block">
              {kickoffLong(match.kickoff)}
              {match.venue ? ` · ${match.venue}` : ""}
            </p>
          ) : null}
        </div>
        <TeamSide
          name={match.away.name}
          short={match.away.short}
          logo={match.away.logo ?? prediction.away.logo}
          color={match.away.color}
          id={match.away.id}
          crest={crest}
          form={formA}
          href={size === "lg" ? teamPath(match.away.name) : undefined}
          competition={match.competition}
        />
      </div>

      {mute ? (
        <p className="rounded-md border border-line bg-pitch px-3 py-3 text-center text-sm text-mist">
          Club français en C1/Europa : pas de prono BetGPT. Score et calendrier seulement.
        </p>
      ) : (
        <>
          {size === "lg" ? <PronoBanner match={match} prediction={prediction} /> : null}

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {boxes.map((b) => {
              const hot = hotMarket === b.market;
              return (
                <div
                  key={b.key}
                  className={cn(
                    "rounded-md px-2 py-3 text-center sm:py-4",
                    hot ? "bg-sage text-ink" : "border border-line bg-pitch text-paper",
                  )}
                >
                  <div
                    className={cn(
                      "text-[11px] font-bold uppercase tracking-[0.16em]",
                      hot ? "text-ink/70" : "text-muted",
                    )}
                  >
                    {b.key}
                  </div>
                  <div className="mt-1 font-mono text-xl font-bold tabular sm:text-3xl">
                    {b.odds ? fmtOdds(b.odds) : "—"}
                  </div>
                  {size === "lg" ? (
                    <div
                      className={cn("mt-1 text-xs font-medium", hot ? "text-ink/70" : "text-muted")}
                    >
                      {fmtPct(b.p, 0)}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {!listed1x2 && match.status === "live" ? (
            <p className="text-center text-sm text-mist">
              Cotes 1X2 live non utilisées. Score en direct seulement.
            </p>
          ) : null}

          {size === "lg" ? (
            <ModelBars
              home={prediction.calibrated.home}
              draw={prediction.calibrated.draw}
              away={prediction.calibrated.away}
              homeShort={match.home.short}
              awayShort={match.away.short}
            />
          ) : advised ? (
            <p className="rounded-md bg-header px-4 py-3 text-center text-sm font-semibold text-on-header">
              Pari conseillé : {notrePronoLabel(match.home.name, match.away.name, advised.market)} @{" "}
              {fmtOdds(advised.bestOdds)}
            </p>
          ) : (
            <p className="rounded-md border border-line px-4 py-3 text-center text-sm text-mist">
              Pas de pari conseillé : aucune sélection à 1,80 ou plus.
            </p>
          )}

          {size === "lg" ? (
            <p className="text-center text-[11px] font-medium uppercase tracking-wide text-muted">
              18+ · Annonce publicitaire · Jouer comporte des risques
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

export function PronoBanner({
  match,
  prediction,
}: {
  match: MatchInput;
  prediction: PredictionRecord;
}) {
  if (skipEuropeFrenchProno(match)) return null;
  const advised = betMarket(prediction.markets);
  if (!advised || !oddsPlayable(advised.bestOdds)) {
    return (
      <div className="rounded-md border border-line bg-surface px-4 py-4 text-center text-sm text-mist">
        Pas de pari conseillé. Aucune cote à 1,80 ou plus.
      </div>
    );
  }
  const label = notrePronoLabel(match.home.name, match.away.name, advised.market);
  const book = bookShort(advised.bestBook);
  const links = prediction.bookLinks.filter((l) => FR_BOOK_RE.test(l.book) && l.url);
  const want = book.toLowerCase();
  const hit = links.find((l) => l.book.toLowerCase().includes(want)) ?? links[0];
  const href = hit ? trackedUrl(hit.book, hit.url, match.id) : null;
  return (
    <div className="overflow-hidden rounded-md border border-sage bg-header text-on-header">
      <p className="bg-sage px-4 py-1.5 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-ink">
        Pari conseillé · 1,80 minimum
      </p>
      <div className="flex flex-col items-center gap-3 px-4 py-4 sm:flex-row sm:justify-between">
        <div className="text-center sm:text-left">
          <p className="text-lg font-bold tracking-tight sm:text-xl">{label}</p>
          <p className="mt-0.5 text-sm text-on-header/70">
            {fmtOdds(advised.bestOdds)}
            {book ? ` chez ${book}` : ""}
            {` · ${fmtPct(advised.modelProb, 0)} modèle`}
          </p>
        </div>
        {href ? (
          <a
            href={href}
            rel="noopener noreferrer sponsored"
            target="_blank"
            onClick={(e) => e.stopPropagation()}
            title="Lien sponsorisé · 18+"
            className="inline-flex min-h-12 w-full items-center justify-center rounded-md bg-sage px-6 text-sm font-bold uppercase tracking-wide text-ink hover:opacity-90 sm:w-auto"
          >
            Voir la cote
          </a>
        ) : null}
      </div>
    </div>
  );
}

export function ModelBars({
  home,
  draw,
  away,
  homeShort,
  awayShort,
}: {
  home: number;
  draw: number;
  away: number;
  homeShort: string;
  awayShort: string;
}) {
  const rows = [
    { k: homeShort, p: home },
    { k: "Nul", p: draw },
    { k: awayShort, p: away },
  ];
  const max = Math.max(home, draw, away);
  return (
    <div className="space-y-2.5">
      <p className="text-xs font-medium text-muted">
        Probabilités selon le modèle BetGPT — pas un vote du public
      </p>
      {rows.map((r) => (
        <div key={r.k} className="flex items-center gap-3">
          <span className="w-10 shrink-0 text-xs font-bold uppercase tracking-wide text-paper">
            {r.k}
          </span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-line">
            <div
              className={cn("h-full rounded-full", r.p === max ? "bg-sage" : "bg-mist/40")}
              style={{ width: `${Math.max(2, r.p * 100)}%` }}
            />
          </div>
          <span className="w-12 shrink-0 text-right text-sm font-semibold tabular text-paper">
            {fmtPct(r.p, 0)}
          </span>
        </div>
      ))}
    </div>
  );
}

function TeamSide({
  name,
  short,
  logo,
  color,
  id,
  crest,
  form,
  href,
  competition,
}: {
  name: string;
  short: string;
  logo?: string;
  color?: string;
  id?: string;
  crest: number;
  form: string[];
  href?: string;
  competition?: string;
}) {
  const body = (
    <>
      <span className="inline-flex max-w-full justify-center [&_img]:max-w-full [&_img]:h-auto">
        <Crest
          name={name}
          short={short}
          logo={logo}
          color={color}
          id={id}
          size={crest}
          competition={competition}
        />
      </span>
      <p className="max-w-full break-words text-center text-sm font-bold leading-snug tracking-tight text-paper hover:text-sage sm:text-lg">
        {name}
      </p>
    </>
  );
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
      {href ? (
        <a
          href={href}
          title={`Pronostic ${name} — cotes et calendrier`}
          className="flex min-w-0 max-w-full flex-col items-center gap-2"
        >
          {body}
        </a>
      ) : (
        body
      )}
      {form.length ? (
        <div
          className="flex max-w-full flex-wrap justify-center gap-1"
          aria-label="Résultats récents"
        >
          {form.map((l, i) => (
            <span
              key={`${l}${i}`}
              className={cn(
                "grid size-5 place-items-center rounded-sm text-[10px] font-bold",
                l === "W"
                  ? "bg-sage text-ink"
                  : l === "L"
                    ? "bg-rust text-on-header"
                    : "bg-line text-muted",
              )}
            >
              {l}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
