import { Link } from "@tanstack/react-router";
import { Crest } from "@/components/crest";
import { LiveScore } from "@/components/live-score";
import { SeoImg } from "@/components/seo-img";
import { VerdictBadge } from "@/components/ui/badge";
import type { MatchInput, PredictionRecord } from "@/engine/types";
import { BRAND_OG } from "@/lib/image-seo";
import {
  editionAnswer,
  editionFaq,
  editionJsonLd,
  editionTitle,
  settlePick,
  type PronoVerdict,
} from "@/lib/news";
import { ld } from "@/lib/ld";
import { featuredAnswer } from "@/lib/seo";

export function ActuFeed({
  matches,
  predictions,
  day,
  url,
  kicker,
}: {
  matches: MatchInput[];
  predictions: PredictionRecord[];
  day: string;
  url: string;
  kicker: string;
}) {
  const preds = new Map(predictions.map((p) => [p.matchId, p]));
  const answer = editionAnswer(matches, preds);
  const faq = editionFaq(matches, preds, day);
  const live = matches.filter((m) => m.status === "live");
  const done = matches.filter((m) => m.status === "finished");
  const soon = matches.filter((m) => m.status === "scheduled");
  return (
    <article className="space-y-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld(editionJsonLd(matches, preds, day, url)) }} />
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sage">{kicker}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{editionTitle(day)}</h1>
        <p className="seo-answer mt-2 max-w-3xl text-base font-medium leading-relaxed text-paper">{answer}</p>
      </header>
      <SeoImg
        seo={{ ...BRAND_OG, alt: editionTitle(day), title: editionTitle(day) }}
        priority
        width={1200}
        height={630}
        className="h-44 w-full rounded-xl object-cover sm:h-56"
      />

      {done.length > 0 ? (
        <section>
          <h2 className="text-lg font-semibold tracking-tight">Résultats football du jour</h2>
          <PronoRecap matches={done} preds={preds} />
          <ResultTable matches={done} preds={preds} />
        </section>
      ) : null}
      {live.length > 0 ? (
        <section>
          <h2 className="text-lg font-semibold tracking-tight">Scores en direct</h2>
          <ResultTable matches={live} preds={preds} />
        </section>
      ) : null}
      {soon.length > 0 ? (
        <section>
          <h2 className="text-lg font-semibold tracking-tight">Pronostics football du jour</h2>
          <ResultTable matches={soon} preds={preds} />
        </section>
      ) : null}

      <ul className="space-y-3">
        {matches.map((m) => {
          const p = preds.get(m.id);
          const settled = settlePick(m, p);
          return (
            <li key={m.id} className="rounded-lg border border-line bg-surface p-4">
              <Link to="/match/$matchId" params={{ matchId: m.slug ?? m.id }} className="block">
                <p className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wider text-muted">
                  <Kicker settled={settled.verdict} status={m.status} />
                  <span>· {m.competition}</span>
                </p>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Crest name={m.home.name} short={m.home.short} logo={m.home.logo} color={m.home.color} id={m.home.id} size={28} />
                    <h3 className="text-base font-semibold text-paper">
                      {m.status === "finished"
                        ? `${m.home.name} – ${m.away.name} : résultat du match`
                        : `${m.home.name} – ${m.away.name} : pronostic et analyse du match`}
                    </h3>
                    <Crest name={m.away.name} short={m.away.short} logo={m.away.logo} color={m.away.color} id={m.away.id} size={28} />
                  </div>
                  <LiveScore match={m} size="sm" />
                </div>
                <p className="mt-2 text-sm font-medium text-paper">
                  {settled.verdict === "aucun"
                    ? settled.label
                    : `Pronostic BetGPT : ${settled.label}${settled.odds ? ` · ${settled.odds}` : ""}${settled.book ? ` chez ${settled.book}` : ""}`}
                  {settled.verdict === "gagnant" || settled.verdict === "perdant" || settled.verdict === "void" ? (
                    <span className="ml-2 inline-block align-middle">
                      <VerdictBadge verdict={settled.verdict} />
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 text-sm text-mist">{p ? featuredAnswer(m, p) : featuredAnswer(m)}</p>
              </Link>
            </li>
          );
        })}
      </ul>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold tracking-tight">Questions fréquentes</h2>
        <dl className="mt-3 space-y-3">
          {faq.map((f) => (
            <div key={f.q}>
              <dt>
                <h3 className="text-sm font-medium text-paper">{f.q}</h3>
              </dt>
              <dd className="mt-1 text-sm text-mist">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </article>
  );
}

function Kicker({ settled, status }: { settled: PronoVerdict; status?: string }) {
  if (settled === "gagnant") return <VerdictBadge verdict="gagnant" />;
  if (settled === "perdant") return <VerdictBadge verdict="perdant" />;
  if (settled === "void") return <VerdictBadge verdict="void" />;
  if (status === "live") return <span>En direct</span>;
  if (status === "finished") return <span>Résultat</span>;
  return <span>Pronostic</span>;
}

function PronoRecap({
  matches,
  preds,
}: {
  matches: MatchInput[];
  preds: Map<string, PredictionRecord>;
}) {
  let won = 0;
  let lost = 0;
  let voided = 0;
  let none = 0;
  for (const m of matches) {
    const v = settlePick(m, preds.get(m.id)).verdict;
    if (v === "gagnant") won += 1;
    else if (v === "perdant") lost += 1;
    else if (v === "void") voided += 1;
    else none += 1;
  }
  const n = won + lost;
  if (!n && !voided) return null;
  return (
    <p className="mt-1 text-sm text-mist">
      Pronostics BetGPT réglés :{" "}
      <span className="font-semibold text-paper">
        {won} gagnant{won > 1 ? "s" : ""}
      </span>
      {" · "}
      <span className="font-semibold text-paper">
        {lost} perdant{lost > 1 ? "s" : ""}
      </span>
      {n ? ` · ${Math.round((won / n) * 100)} % de justesse` : null}
      {voided ? ` · ${voided} remboursé${voided > 1 ? "s" : ""}` : null}
      {none ? ` · ${none} sans prono` : null}
    </p>
  );
}

function ResultTable({
  matches,
  preds,
}: {
  matches: MatchInput[];
  preds: Map<string, PredictionRecord>;
}) {
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-line">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-raised text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
          <tr>
            <th className="px-3 py-2">Match</th>
            <th className="px-3 py-2">Score</th>
            <th className="px-3 py-2">Pronostic BetGPT</th>
            <th className="px-3 py-2">Verdict</th>
          </tr>
        </thead>
        <tbody>
          {matches.map((m) => {
            const settled = settlePick(m, preds.get(m.id));
            return (
              <tr key={m.id} className="border-t border-line">
                <td className="px-3 py-2">
                  <Link to="/match/$matchId" params={{ matchId: m.slug ?? m.id }} className="hover:text-sage">
                    {m.home.name} – {m.away.name}
                  </Link>
                </td>
                <td className="px-3 py-2 tabular font-semibold">
                  {m.status === "scheduled" ? "—" : `${m.scoreHome ?? 0}–${m.scoreAway ?? 0}`}
                </td>
                <td className="px-3 py-2">
                  <p className="font-medium text-paper">{settled.label}</p>
                  {settled.odds ? (
                    <p className="text-[12px] text-mist">
                      {settled.odds}
                      {settled.book ? ` · ${settled.book}` : ""}
                    </p>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  <VerdictBadge verdict={settled.verdict} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
