import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import type { MatchArticle as Article } from "@/engine/article";
import { formatParis } from "@/lib/match-clock";

import { fmtPct } from "@/lib/utils";
import { BroadcastLinks, BroadcasterText } from "@/components/broadcaster-text";

export function MatchVerdict({
  article,
  asOf,
  freshness,
}: {
  article: Article;
  asOf?: string;
  freshness?: string;
}) {
  const p = article.probs;
  return (
    <section className="rounded-xl border border-sage/40 bg-surface p-5 shadow-soft sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-sage">
        Estimation du modèle BetGPT
      </p>
      <h2 className="mt-1 text-xl font-bold tracking-tight text-paper">{article.verdictLabel}</h2>
      {article.likelyScore ? (
        <p className="mt-2 text-sm text-mist">
          Score le plus probable :{" "}
          <span className="font-semibold text-paper">{article.likelyScore}</span>
          {article.likelyScoreP != null ? ` · ${fmtPct(article.likelyScoreP)} des simulations` : ""}
        </p>
      ) : null}
      {p ? (
        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-md border border-line bg-pitch px-2 py-3">
            <dt className="text-[11px] uppercase tracking-wider text-muted">1</dt>
            <dd className="mt-1 text-lg font-semibold tabular text-paper">
              {Math.round(p.home * 100)} %
            </dd>
          </div>
          <div className="rounded-md border border-line bg-pitch px-2 py-3">
            <dt className="text-[11px] uppercase tracking-wider text-muted">N</dt>
            <dd className="mt-1 text-lg font-semibold tabular text-paper">
              {Math.round(p.draw * 100)} %
            </dd>
          </div>
          <div className="rounded-md border border-line bg-pitch px-2 py-3">
            <dt className="text-[11px] uppercase tracking-wider text-muted">2</dt>
            <dd className="mt-1 text-lg font-semibold tabular text-paper">
              {Math.round(p.away * 100)} %
            </dd>
          </div>
        </dl>
      ) : null}
      <p className="mt-3 text-xs text-muted">
        {article.confidence10 != null
          ? `Indice interne ${article.confidence10.toFixed(1).replace(".", ",")}/10 — ${article.confidenceLabel} (pas un taux de réussite)`
          : `Confiance ${article.confidenceLabel}`}
        {" · "}
        Dernière mise à jour : {asOf ? formatParis(asOf) : "horodatage indisponible"}
        {freshness ? ` · Fraîcheur : ${freshness}` : ""}
      </p>
      <p className="seo-answer mt-4 text-sm leading-relaxed text-paper"><BroadcasterText text={article.lead} /></p>
    </section>
  );
}

export function MatchArticleBody({ article }: { article: Article }) {
  return (
    <div className="space-y-6">
      <BroadcastLinks texts={[article.lead, ...article.sections.flatMap((section) => [...section.paragraphs, ...(section.items ?? [])])]} />
      <nav aria-label="Sommaire de l’analyse" className="flex flex-wrap gap-2">
        {article.sections.map((s) => (
          <a
            key={s.id}
            href={`#analyse-${s.id}`}
            className="inline-flex min-h-11 items-center rounded-md border border-line bg-surface px-3 text-sm text-mist hover:text-paper"
          >
            {s.h2}
          </a>
        ))}
      </nav>
      {article.sections.map((s) => (
        <section
          key={s.id}
          id={`analyse-${s.id}`}
          className="scroll-mt-24 rounded-xl border border-line bg-surface p-5 sm:p-6"
        >
          <h2 className="text-lg font-semibold tracking-tight">{s.h2}</h2>
          {s.paragraphs.map((p) => (
            <p key={p} className="mt-3 max-w-prose text-base leading-relaxed text-paper">
              <BroadcasterText text={p} />
            </p>
          ))}
          {s.items?.length ? (
            s.id === "cles" ? (
              <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-paper">
                {s.items.map((item) => (
                  <li key={item.slice(0, 40)}><BroadcasterText text={item} /></li>
                ))}
              </ol>
            ) : (
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-paper">
                {s.items.map((item) => (
                  <li key={item.slice(0, 40)}>{item}</li>
                ))}
              </ul>
            )
          ) : null}
        </section>
      ))}
      <p className="text-xs text-muted">
        Méthode et limites :{" "}
        <Link to="/methodology" className="text-sage hover:underline">
          méthode
        </Link>
        {" · "}
        <Link to="/data-sources" className="text-sage hover:underline">
          sources
        </Link>
        {" · "}
        <Link to="/ledger" className="text-sage hover:underline">
          bilan public
        </Link>
        {" · "}
        <Link to="/about" className="text-sage hover:underline">
          à propos
        </Link>
        . 18+.
      </p>
    </div>
  );
}

export function MatchAdvanced({ article, children }: { article: Article; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-xl border border-line bg-surface p-5 sm:p-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-full items-center justify-between gap-3 text-left"
      >
        <h2 className="text-lg font-semibold tracking-tight">Voir les statistiques avancées</h2>
        <span className="text-sm font-semibold text-sage">{open ? "Masquer" : "Ouvrir"}</span>
      </button>
      {open ? (
        <div className="mt-4 space-y-4">
          {article.advanced.map((row) => (
            <div key={row.label}>
              <p className="text-sm font-medium text-paper">{row.label}</p>
              <p className="mt-1 text-sm text-mist"><BroadcasterText text={row.text} /></p>
              {row.tooltip ? <p className="mt-1 text-xs text-muted">{row.tooltip}</p> : null}
            </div>
          ))}
          {children}
        </div>
      ) : null}
    </section>
  );
}

export function MatchFaq({ article }: { article: Article }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-5 sm:p-6">
      <h2 className="text-lg font-semibold tracking-tight">Questions fréquentes</h2>
      <dl className="mt-3 space-y-3">
        {article.faq.map((f) => (
          <div key={f.q}>
            <dt>
              <h3 className="text-sm font-medium text-paper">{f.q}</h3>
            </dt>
            <dd className="mt-1 text-sm text-mist"><BroadcasterText text={f.a} /></dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
