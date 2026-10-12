import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { getLedgerDesk } from "@/lib/desk.functions";
import { DECISION_LABEL, LEAGUE_LABEL, MODEL_LABEL } from "@/lib/labels";
import { Crest } from "@/components/crest";
import { CupNight } from "@/components/cup-night";
import { VerdictBadge } from "@/components/ui/badge";
import { fmtEur, fmtOdds, fmtSignedPct } from "@/lib/utils";
import type { CanonicalReplayEvidenceRow } from "@/engine/canonical-roi5-evidence";
import { SITE_URL } from "@/lib/seo";
import { AstraSidewings } from "@/components/astra-sidewings";

export const Route = createFileRoute("/ledger")({
  loader: () => getLedgerDesk(),
  head: () => ({
    meta: [
      { title: "Bilan et historique des pronostics football | BetGPT" },
      {
        name: "description",
        content:
          "Bilan BetGPT : ROI historique calculé à partir des statistiques des matchs, méthode et résultats des pronostics réellement publiés, match par match.",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Bilan des pronostics BetGPT" },
      { property: "og:url", content: `${SITE_URL}/ledger` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/ledger` }],
  }),
  component: LedgerPage,
});

function LedgerPage() {
  const data = Route.useLoaderData();
  const r = data.review;
  const [tab, setTab] = useState<"done" | "soon" | "mise">("done");
  const [showAllCanonical, setShowAllCanonical] = useState(false);
  const canonical = data.canonicalReplay;
  const canonicalRows = (showAllCanonical ? canonical.rows : canonical.rows.slice(-25)).slice().reverse();
  const ranked = [...data.championship.models, data.championship.ensemble, data.championship.tactical].sort(
    (a, b) => a.brier - b.brier,
  );
  const best = ranked[0];
  const base = data.championship.ablation.find((a) => a.name === "BASELINE");
  const tac = data.championship.ablation.find((a) => a.name === "TACTICAL");
  const tacticalHelps = Boolean(base && tac && tac.brier < base.brier - 0.002);
  const asOf = data.liveAsOf
    ? format(new Date(data.liveAsOf), "d MMM · HH:mm", { locale: fr })
    : "";
  const ev = data.evidence;
  const datasetJsonLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    "@id": `${SITE_URL}/ledger#prediction-dataset`,
    name: "Registre public des pronostics football BetGPT",
    description:
      "Registre public BetGPT des pronostics football publiés, avec horodatage avant coup d’envoi, marché, probabilité, cote lorsqu’elle est disponible, version du moteur et résultat après règlement. Les pertes restent visibles et les simulations historiques sont distinguées des pronostics réellement publiés.",
    url: `${SITE_URL}/ledger`,
    identifier: `${SITE_URL}/ledger#prediction-dataset`,
    creator: {
      "@type": "Organization",
      name: "BetGPT",
      url: SITE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: "BetGPT",
      url: SITE_URL,
    },
    isAccessibleForFree: true,
    keywords: [
      "pronostics football",
      "pronostics sportifs",
      "historique pronostics",
      "ROI paris sportifs",
      "drawdown",
      "Brier score",
      "probabilités football",
    ],
    distribution: [
      {
        "@type": "DataDownload",
        encodingFormat: "application/json",
        contentUrl: `${SITE_URL}/evidence.json`,
      },
      {
        "@type": "DataDownload",
        encodingFormat: "text/csv",
        contentUrl: `${SITE_URL}/evidence.csv`,
      },
    ],
  };
  const engineN = data.historyN ?? 0;
  const engineReady = engineN >= 30 && Boolean(best && best.brier > 0);

  const rows = useMemo(() => {
    if (tab === "mise") return r.rows.filter((x) => x.kind === "mise");
    if (tab === "soon") return r.rows.filter((x) => x.kind !== "mise" && !x.result);
    return r.rows.filter((x) => x.kind !== "mise" && (x.result === "win" || x.result === "lose"));
  }, [r.rows, tab]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(datasetJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <AstraSidewings
      ariaLabel="Navigation contextuelle du bilan BetGPT"
      left={{
        eyebrow: "Comprendre le bilan",
        title: "Du pronostic à la preuve",
        intro: "Remonte le silo BetGPT sans quitter le contexte du bilan public.",
        links: [
          { href: "/pronostics-football", label: "Pronostics football", description: "Les analyses et sélections actuellement publiées." },
          { href: "/prediction-history", label: "Historique des prédictions", description: "Comment BetGPT conserve et relit ses décisions." },
          { href: "/rapports/precision", label: "Rapport de précision", description: "Calibration, erreurs et qualité probabiliste." },
          { href: "/methodology", label: "Méthodologie", description: "Règles du modèle, limites et contrôles." },
        ],
      }}
      right={{
        eyebrow: "Vérifier",
        title: "Lire les chiffres correctement",
        intro: "Le bilan distingue données publiées, replay historique et hypothèses de simulation.",
        stats: [
          { label: "Mise repère", value: "100 €", detail: "Conversion UX commune pour comparer gains et pertes." },
          { label: "Historique testé", value: String(canonical.summary.n), detail: "Paris du replay historique affiché sur cette page." },
          { label: "Pronostics publiés", value: String(ev?.published ?? 0), detail: "Décisions enregistrées dans le registre public." },
        ],
        links: [
          { href: "/data-sources", label: "Sources des données", description: "Origine et limites des données utilisées." },
          { href: "/jeu-responsable", label: "Jeu responsable", description: "Interpréter une performance sans la transformer en promesse." },
          { href: "/comparer-cotes", label: "Comparer les cotes", description: "Comparer les prix disponibles séparément du bilan." },
          { href: "/opportunities", label: "Opportunités du jour", description: "Voir les écarts actuellement détectés." },
        ],
      }}
    >
      <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-emerald-400/25 bg-gradient-to-br from-[#071923] via-[#102b32] to-[#133d30] px-5 py-8 text-white shadow-[0_24px_65px_rgba(5,30,28,0.18)] sm:px-9 sm:py-11" aria-labelledby="historical-roi-headline">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)] lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs font-bold uppercase tracking-[0.23em] text-emerald-200">BetGPT · Bilan de performance</p>
              <span className="rounded-full border border-white/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white/80">Archive vérifiable</span>
            </div>
            <h1 id="historical-roi-headline" className="mt-5 max-w-2xl text-3xl font-bold tracking-tight sm:text-5xl">
              Notre méthode. <span className="text-emerald-300">Ses résultats.</span> Sans masquer les pertes.
            </h1>
            <p className="mt-6 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-200">
              ROI historique calculé · méthode BetGPT
            </p>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-1">
              <span data-testid="historical-roi-value" className="font-display text-6xl font-black tabular-nums tracking-tighter text-white sm:text-8xl">
                {fmtSignedPct(canonical.summary.roi)}
              </span>
              <span className="text-sm font-medium text-emerald-100">sur {canonical.summary.n} sélections historiques</span>
            </div>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-200 sm:text-base">
              Voici le rendement obtenu en rejouant chronologiquement notre méthode sur des résultats d'archives,
              avec le marché 1N2 comme pari principal et des protections ponctuelles sur score exact.
              <strong className="font-semibold text-white"> C'est un résultat de backtest calculé, pas une promesse et pas le rendement des paris publiés en direct.</strong>
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="#historique-paris" className="inline-flex min-h-11 items-center rounded-xl bg-emerald-300 px-5 text-sm font-bold text-[#092d24] shadow-sm transition hover:bg-emerald-200">
                Auditer les {canonical.summary.n} paris
              </a>
              <a href="#pronostics-publics" className="inline-flex min-h-11 items-center rounded-xl border border-white/30 px-5 text-sm font-semibold text-white transition hover:bg-white/10">
                Voir les pronostics publiés
              </a>
            </div>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/[0.07] p-5 backdrop-blur-sm sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-200">Le test en chiffres</p>
            <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-6">
              <div><p className="text-xs text-slate-300">Sélections</p><p className="mt-1 text-3xl font-black tabular-nums">{canonical.summary.n}</p></div>
              <div><p className="text-xs text-slate-300">Taux de réussite 1N2</p><p className="mt-1 text-3xl font-black tabular-nums">{(canonical.summary.hitRate * 100).toFixed(1).replace(".", ",")} %</p></div>
              <div><p className="text-xs text-slate-300">Gagnants / perdants</p><p className="mt-1 text-2xl font-bold tabular-nums">{canonical.summary.wins} / {canonical.summary.losses}</p></div>
              <div><p className="text-xs text-slate-300">Bénéfice simulé</p><p className="mt-1 text-2xl font-bold tabular-nums text-emerald-200">{fmtEur(canonical.summary.profit * 100, true)}</p></div>
            </div>
            <p className="mt-6 border-t border-white/15 pt-4 text-xs leading-6 text-slate-200">
              Mise de référence : 100 € par sélection principale, plus les éventuelles protections.
              Capital simulé total : <strong className="text-white">{fmtEur(canonical.summary.capital * 100)}</strong>.
              Cotes historiques modélisées et reconstruites, non enregistrées chez un bookmaker.
            </p>
          </div>
        </div>
      </section>

      <section className="section-card p-5 sm:p-8" aria-labelledby="historical-curve-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">La trajectoire, pas seulement un pourcentage</p>
            <h2 id="historical-curve-title" className="mt-1 font-display text-2xl font-bold text-paper">Courbe des gains et des pertes du test</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-mist">
              Résultat net cumulé en unités de 100 € : tous les paris gagnés, perdus et les coûts de protection restent dans le calcul.
            </p>
          </div>
          <span className="rounded-full border border-line px-3 py-2 text-xs font-semibold text-mist">
            {canonical.summary.n} décisions chronologiques
          </span>
        </div>
        <div className="mt-5">
          <HistoricalEquityChart rows={canonical.rows} />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-line/70 bg-surface/60 px-4 py-4">
            <p className="text-xs text-muted">ROI sur la tranche finale</p>
            <p className="mt-1 font-display text-2xl font-bold tabular-nums text-paper">{fmtSignedPct(canonical.summary.validationRoi)}</p>
            <p className="mt-1 text-xs text-muted">{canonical.summary.validationN} sélections du test final</p>
          </div>
          <div className="rounded-xl border border-line/70 bg-surface/60 px-4 py-4">
            <p className="text-xs text-muted">Plus forte baisse historique</p>
            <p className="mt-1 font-display text-2xl font-bold tabular-nums text-paper">{canonical.summary.maxDrawdown.toFixed(2).replace(".", ",")} unités</p>
            <p className="mt-1 text-xs text-muted">Point haut à point bas de la courbe</p>
          </div>
          <div className="rounded-xl border border-line/70 bg-surface/60 px-4 py-4">
            <p className="text-xs text-muted">Protections gagnantes</p>
            <p className="mt-1 font-display text-2xl font-bold tabular-nums text-paper">{canonical.summary.hedgeHits} / {canonical.summary.hedges}</p>
            <p className="mt-1 text-xs text-muted">Scores exacts utilisés en couverture</p>
          </div>
        </div>
      </section>

      <details className="group section-card p-5 sm:p-6">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-paper">
          <span className="text-lg">Comprendre comment le +{(canonical.summary.roi * 100).toFixed(2).replace(".", ",")} % historique a été calculé</span>
          <span className="rounded-full border border-line px-3 py-1 text-xs text-mist group-open:hidden">Voir la méthode</span>
        </summary>
        <div className="mt-5 space-y-4 border-t border-line pt-5 text-sm leading-7 text-mist">
          <p>
            Les décisions ont été rejouées dans l’ordre chronologique à partir d’une archive de résultats.
            Le pari principal reste le marché 1N2 ; les cotes retenues par la sélection sont comprises entre 1,80 et 3,00.
            Une couverture de score exact est ajoutée seulement si la règle historique la sélectionne.
          </p>
          <p>
            <strong>Pas de confusion de provenance :</strong> les scores finaux proviennent de l’archive,
            tandis que les cotes historiques sont reconstruites par le modèle, non observées chez un bookmaker.
            Les gains indiqués sont des unités de simulation, et les pertes restent dans toutes les statistiques.
          </p>
          <p>
            Le test a une phase chronologique finale de {canonical.summary.validationN} sélections, au rendement
            {fmtSignedPct(canonical.summary.validationRoi)}. Il ne prouve pas que le même rendement serait reproductible
            avec des cotes réelles ou des mises futures. Le calcul utilise le capital simulé réellement engagé,
            protections incluses.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="ROI historique total" value={fmtSignedPct(canonical.summary.roi)} />
            <Kpi label="Validation finale" value={fmtSignedPct(canonical.summary.validationRoi)} />
            <Kpi label="Capital simulé" value={fmtEur(canonical.summary.capital * 100)} />
            <Kpi label="Recul maximal" value={`${canonical.summary.maxDrawdown.toFixed(2)} mises`} />
          </div>
        </div>
      </details>

      <section id="historique-paris" className="section-card scroll-mt-20 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Match par match · vérification publique</p>
            <h2 className="mt-1 font-display text-2xl">Les {canonical.summary.n} paris utilisés pour calculer ce bilan</h2>
            <p className="mt-2 max-w-4xl text-sm leading-relaxed text-mist">
              Ici, rien n’est caché : chaque match du test est affiché avec le pari choisi, la cote utilisée
              par la simulation, le score final et le gain ou la perte simulé. Les cotes ne sont pas des
              captures d’un bookmaker prises au moment du match : elles ont été reconstruites pour ce test.
            </p>
          </div>
          <button
            type="button"
            className="chip-pill cursor-pointer"
            onClick={() => setShowAllCanonical((v) => !v)}
          >
            {showAllCanonical ? "Afficher les 25 plus récents" : `Afficher les ${canonical.summary.n}`}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Kpi label="🟢 Gagnants" value={String(canonical.summary.wins)} />
          <Kpi label="🔴 Perdants" value={String(canonical.summary.losses)} />
          <Kpi label="🎯 Taux de réussite" value={`${(canonical.summary.hitRate * 100).toFixed(1).replace(".", ",")} %`} />
          <Kpi label="🛡️ Protections réussies" value={`${canonical.summary.hedgeHits}/${canonical.summary.hedges}`} />
          <Kpi label="Résultat historique · base 100 €" value={fmtEur(canonical.summary.profit * 100, true)} />
        </div>

        <div className="mt-4 rounded-2xl border border-line bg-white/70 p-4 text-sm shadow-sm">
          <p className="font-semibold text-paper">
            Lecture express : <span className="text-sage">{canonical.summary.wins} gagnants</span>
            {" · "}
            <span className="text-rust">{canonical.summary.losses} perdants</span>
            {" · "}
            <span className={canonical.summary.profit >= 0 ? "text-sage" : "text-rust"}>
              {fmtEur(canonical.summary.profit * 100, true)} de résultat simulé
            </span>
          </p>
          <p className="mt-1 text-xs text-muted">
            Base de lecture : 100 € sur chaque pari principal ; le capital investi dans les protections s’ajoute à la mise de base.
          </p>
        </div>

        <div className="mt-5 space-y-3 lg:hidden">
          {canonicalRows.map((row) => (
            <article key={row.id} className="rounded-xl border border-line bg-white/70 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-muted">{format(new Date(row.kickoff), "dd/MM/yyyy")} · {LEAGUE_LABEL[row.league] ?? row.league}</p>
                  <h3 className="mt-1 text-sm font-bold text-paper">{row.home} – {row.away}</h3>
                  <p className="mt-1 text-xs text-mist">Pari 1N2 : victoire {row.selection} · cote reconstruite {row.odds.toFixed(2)}</p>
                </div>
                <span className={row.result === "win" ? "rounded-lg bg-sage/10 px-2 py-1 text-xs font-bold text-sage" : "rounded-lg bg-rust/10 px-2 py-1 text-xs font-bold text-rust"}>
                  {row.result === "win" ? "GAGNÉ" : "PERDU"}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line/70 pt-3 text-sm">
                <div><span className="block text-xs text-muted">Score final</span><strong className="text-paper">{row.score}</strong></div>
                <div><span className="block text-xs text-muted">Gain / perte simulé</span><strong className={row.pnl >= 0 ? "text-sage" : "text-rust"}>{fmtEur(row.pnl * 100, true)}</strong></div>
                <div><span className="block text-xs text-muted">Protection score exact</span><strong className="text-paper">{row.hedge ? `${row.hedge.score} · ${row.hedge.hit ? "gagnée" : "perdue"}` : "Aucune"}</strong></div>
                <div><span className="block text-xs text-muted">Cumul historique</span><strong className={row.cumulativePnl >= 0 ? "text-sage" : "text-rust"}>{fmtEur(row.cumulativePnl * 100, true)}</strong></div>
              </div>
            </article>
          ))}
        </div>
        <div className="mt-4 hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[1120px] text-sm">
            <thead className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
              <tr className="border-b border-line">
                <th className="py-2 pr-3 font-medium">#</th>
                <th className="py-2 pr-3 font-medium">Date</th>
                <th className="py-2 pr-3 font-medium">Match</th>
                <th className="py-2 pr-3 font-medium">Pari</th>
                <th className="py-2 pr-3 font-medium">Cote du test*</th>
                <th className="py-2 pr-3 font-medium">Score</th>
                <th className="py-2 pr-3 font-medium">Verdict</th>
                <th className="py-2 pr-3 font-medium">Protection score exact</th>
                <th className="py-2 pr-3 font-medium">Gain / perte · 100 €</th>
                <th className="py-2 pr-3 font-medium">Cumul · 100 €</th>
                <th className="py-2 pr-3 font-medium">Phase du test</th>
              </tr>
            </thead>
            <tbody>
              {canonicalRows.map((row) => (
                <tr
                  key={row.id}
                  className={`border-b border-line/50 align-top transition-colors ${row.result === "win" ? "bg-sage/5 hover:bg-sage/10" : "bg-rust/5 hover:bg-rust/10"}`}
                >
                  <td className="py-3 pr-3 tabular text-muted">{row.sequence}</td>
                  <td className="py-3 pr-3 whitespace-nowrap text-mist">
                    {format(new Date(row.kickoff), "dd/MM/yyyy")}
                  </td>
                  <td className="py-3 pr-3">
                    <div className="flex min-w-[280px] flex-wrap items-center gap-2 font-medium text-paper">
                      <Crest
                        name={row.home}
                        short={row.home.slice(0, 3)}
                        size={26}
                        competition={row.league}
                      />
                      <span>{row.home}</span>
                      <span className="text-muted">–</span>
                      <Crest
                        name={row.away}
                        short={row.away.slice(0, 3)}
                        size={26}
                        competition={row.league}
                      />
                      <span>{row.away}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted">{LEAGUE_LABEL[row.league] ?? row.league}</div>
                  </td>
                  <td className="py-3 pr-3 text-paper">
                    Victoire {row.selection}
                  </td>
                  <td className="py-3 pr-3 tabular">{row.odds.toFixed(2)}</td>
                  <td className="py-3 pr-3 tabular font-medium text-paper">{row.score}</td>
                  <td className="py-3 pr-3">
                    <span
                      className={
                        row.result === "win"
                          ? "inline-flex rounded-full border border-sage/40 bg-sage/10 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-sage"
                          : "inline-flex rounded-full border border-rust/40 bg-rust/10 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-rust"
                      }
                    >
                      {row.result === "win" ? "GAGNANT" : "PERDU"}
                    </span>
                  </td>
                  <td className="py-3 pr-3 text-xs text-mist">
                    {row.hedge
                      ? `${row.hedge.score} à ${row.hedge.odds.toFixed(2)} · ${fmtEur(row.hedge.stake * 100)} · ${row.hedge.hit ? "réussi" : "raté"}`
                      : "—"}
                  </td>
                  <td className="py-3 pr-3 tabular font-bold">
                    <span className={row.pnl >= 0 ? "text-sage" : "text-rust"}>
                      {fmtEur(row.pnl * 100, true)}
                    </span>
                  </td>
                  <td className="py-3 pr-3 tabular font-semibold">
                    <span className={row.cumulativePnl >= 0 ? "text-sage" : "text-rust"}>
                      {fmtEur(row.cumulativePnl * 100, true)}
                    </span>
                  </td>
                  <td className="py-3 pr-3 text-xs text-mist">{row.validation20 ? "Test final" : "Mise au point"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 space-y-1 text-xs leading-relaxed text-muted">
          <p>
            * Cote du test : valeur reconstruite pour la simulation historique, pas une cote bookmaker
            enregistrée à l’heure du match.
          </p>
          <p>Les scores finaux viennent de l’archive historique des matchs.</p>
          <p>
            Tous les gains et pertes de ce tableau sont convertis en euros sur une base simple : 100 € sur le pari principal.
            Exemple : +0,89 unité = +89 € ; -1 unité = -100 €. Un petit pari complémentaire sur un score exact peut s’ajouter
            quand la méthode le prévoit. Les matchs les plus récents sont affichés en premier.
          </p>
        </div>
      </section>

      {ev ? (
        <section id="pronostics-publics" className="section-card scroll-mt-20 p-5 sm:p-6">
          <h2 className="font-display text-xl">Résultats des pronostics réellement publiés</h2>
          <p className="mt-1 text-sm text-mist">
            Ici, on compte seulement les paris 1-N-2 que BetGPT a réellement publiés avant le coup
            d’envoi. Les simples idées à surveiller, les matchs écartés et les anciennes versions
            ne gonflent pas le bilan. {ev.sampleLabel}.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Paris publiés" value={String(ev.published)} />
            <Kpi label="Publiés avant le match" value={String(ev.beforeKickoff)} />
            <Kpi label="Paris terminés" value={String(ev.settled)} />
            <Kpi
              label="Rendement simulé"
              value={ev.roi == null ? "Non vérifié" : fmtSignedPct(ev.roi)}
            />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi
              label="Taux de réussite"
              value={ev.winRate == null ? "Non vérifié" : `${Math.round(ev.winRate * 100)} %`}
            />
            <Kpi
              label="Score de fiabilité"
              value={ev.brier == null ? "Non vérifié" : ev.brier.toFixed(3)}
            />
            <Kpi label="Paris perdants" value={String(ev.losses)} />
            <Kpi label="Publiés trop tard · exclus" value={String(ev.afterKickoff)} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi
              label="Victoires prévues / réelles"
              value={
                ev.settled && ev.expectedHits != null
                  ? `${ev.expectedHits.toFixed(1)} → ${ev.observedHits}`
                  : "Non vérifié"
              }
            />
            <Kpi
              label="Évolution face au marché"
              value={ev.clv == null ? "Indisponible" : fmtSignedPct(ev.clv)}
            />
            <Kpi
              label="Plus forte baisse"
              value={ev.maxDrawdown == null ? "Non vérifié" : ev.maxDrawdown.toFixed(2)}
            />
            <Kpi label="Plus longue série G / P" value={`${ev.longestWin} / ${ev.longestLose}`} />
          </div>
          <p className="mt-3 text-xs text-muted">
            Le rendement est calculé comme si chaque pari retenu valait 1 unité. Aucun argent réel
            n’est supposé avoir été misé. Les matchs seulement surveillés ou écartés ne sont pas
            comptés. Le score de fiabilité mesure l’écart entre les probabilités annoncées et les résultats : plus il est bas, mieux c’est.
            {ev.unavailable.length ? ` Données indisponibles : ${ev.unavailable.join(", ")}.` : ""}
          </p>
          {ev.calibration.some((b) => b.n > 0) ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
                  <tr className="border-b border-line">
                    <th className="py-2 pr-3 font-medium">Prob. annoncée</th>
                    <th className="py-2 pr-3 font-medium">Matchs</th>
                    <th className="py-2 pr-3 font-medium">Réussite réelle</th>
                    <th className="py-2 pr-3 font-medium">Volume de données</th>
                  </tr>
                </thead>
                <tbody>
                  {ev.calibration.map((b) => (
                    <tr key={b.label} className="border-b border-line/50">
                      <td className="py-2 pr-3 text-paper">{b.label}</td>
                      <td className="py-2 pr-3 tabular">{b.n}</td>
                      <td className="py-2 pr-3 tabular">
                        {b.n === 0 ? "—" : `${Math.round(b.observed * 100)} %`}
                      </td>
                      <td className="py-2 pr-3 text-mist">
                        {b.n === 0 ? "Indisponible" : b.band === "early" ? "Précoce" : b.band === "limited" ? "Limité" : "Significatif"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-3 text-sm text-mist">Calibration : échantillon insuffisant.</p>
          )}
          {ev.models.length ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
                  <tr className="border-b border-line">
                    <th className="py-2 pr-3 font-medium">Méthode</th>
                    <th className="py-2 pr-3 font-medium">Matchs</th>
                    <th className="py-2 pr-3 font-medium">Score de fiabilité*</th>
                    <th className="py-2 pr-3 font-medium">Rendement simulé</th>
                    <th className="py-2 pr-3 font-medium">Réussite</th>
                    <th className="py-2 pr-3 font-medium">Volume de données</th>
                  </tr>
                </thead>
                <tbody>
                  {ev.models.map((m, index) => (
                    <tr key={m.engine} className="border-b border-line/50">
                      <td className="py-2 pr-3 text-paper">{publicMethodName(m.engine, index)}</td>
                      <td className="py-2 pr-3 tabular">{m.n}</td>
                      <td className="py-2 pr-3 tabular">{m.brier == null ? "Non vérifié" : m.brier.toFixed(3)}</td>
                      <td className="py-2 pr-3 tabular">{m.roi == null ? "Non vérifié" : fmtSignedPct(m.roi)}</td>
                      <td className="py-2 pr-3 tabular">{m.winRate == null ? "Non vérifié" : `${Math.round(m.winRate * 100)} %`}</td>
                      <td className="py-2 pr-3 text-mist">
                        {m.band === "unverified"
                          ? "Insuffisant"
                          : m.band === "early"
                            ? "Précoce"
                            : m.band === "limited"
                              ? "Limité"
                              : "Significatif"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-3 text-sm text-mist">Comparaison des méthodes : pas encore assez de données publiques.</p>
          )}
        </section>
      ) : null}

      {r.clNight ? <CupNight night={r.clNight} /> : null}

      <details className="section-card p-5 sm:p-6">
        <summary className="cursor-pointer text-lg font-bold text-paper">
          Simulation complémentaire des pronostics publics (hors ROI historique)
        </summary>
        <p className="mt-4 text-sm leading-6 text-mist">
          Cette simulation séparée utilise les pronostics enregistrés publiquement ; elle ne s'ajoute
          jamais au +{(canonical.summary.roi * 100).toFixed(2).replace(".", ",")} % du replay historique.
          Un bénéfice fictif n'est pas assimilé à un gain réellement encaissé.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="Paris concernés" value={String(r.sim.n)} />
          <Kpi label="Mise / retours simulés" value={`${fmtEur(r.sim.mainStaked)} / ${fmtEur(r.sim.mainReturned)}`} />
          <Kpi label="Protections utilisées" value={String(r.sim.covered)} />
          <Kpi label="Résultat net simulé" value={fmtEur(r.sim.profit, true)} />
        </div>
        <p className="mt-4 text-xs leading-6 text-muted">
          Pari principal : {fmtEur(r.sim.mainStaked)} engagé, {fmtEur(r.sim.mainReturned)} retourné.
          Couvertures : {fmtEur(r.sim.coverStaked)} engagés, {fmtEur(r.sim.coverReturned)} retournés.
          Rendement simulé distinct : {r.sim.n ? fmtSignedPct(r.sim.roi) : "non calculé"}.
        </p>
      </details>

      <section className="section-card p-5 sm:p-6">
        <h2 className="font-display text-xl">Quelle méthode prédit le mieux ?</h2>
        <p className="mt-2 text-sm text-mist">
          Comparaison sur {engineN} anciens matchs. Plus le score d’erreur est bas, mieux les
          probabilités annoncées correspondent aux résultats.
        </p>
        {engineReady && best ? (
          <p className="mt-3 text-paper">
            Meilleure méthode sur ce test : {MODEL_LABEL[best.name] ?? best.name}. Score d’erreur {best.brier.toFixed(3)}.
          </p>
        ) : (
          <p className="mt-3 text-paper">Non vérifié · échantillon insuffisant pour désigner un moteur.</p>
        )}
        <p className="mt-2 text-sm text-mist">
          {tacticalHelps
            ? "L'ajustement tactique réduit l'erreur sur cet échantillon. Cela reste à confirmer sur de nouveaux matchs."
            : "L'ajustement tactique ne réduit pas suffisamment l'erreur sur cet échantillon."}
        </p>
        {base && tac ? (
          <p className="mt-1 text-xs text-muted">
            Chiffres seuls : score {base.brier.toFixed(3)} · avec lecture du match : {tac.brier.toFixed(3)}
            {r.clv ? ` · écart vs cote finale ${fmtSignedPct(r.clv)}` : ""}
          </p>
        ) : null}
      </section>

      <section className="section-card p-5 sm:p-6">
        <h2 className="font-display text-xl">Ce que BetGPT corrige après ses erreurs</h2>
        <p className="mt-1 text-sm text-mist">
          Les probabilités et certaines règles sont ajustées à partir des résultats enregistrés.
          Une correction n’est considérée utile que si elle améliore ensuite les nouveaux matchs,
          sans modifier les anciens résultats.
        </p>
        {data.errorLearn ? (
          <>
            <p className="mt-3 text-sm text-paper">
              {data.errorLearn.n} pronos tranchés · {data.errorLearn.nWrong} faux · annoncé{" "}
              {Math.round(data.errorLearn.meanP * 100)} % · réel{" "}
              {Math.round(data.errorLearn.hitRate * 100)} %.
              {data.errorLearn.recentMiseN
                ? ` Mises récentes : ${Math.round(data.errorLearn.recentMiseHit * 100)} % sur ${data.errorLearn.recentMiseN}.`
                : ""}
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-mist">
              {(data.errorLearn.lessons?.length ? data.errorLearn.lessons : data.errorLearn.notes).map((n: string) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-3 text-sm text-mist">En attente des premiers scores.</p>
        )}
      </section>

      <div className="surface-card flex flex-wrap gap-2 p-3">
        <Tab active={tab === "done"} onClick={() => setTab("done")}>
          Terminés
        </Tab>
        <Tab active={tab === "soon"} onClick={() => setTab("soon")}>
          À jouer
        </Tab>
        <Tab active={tab === "mise"} onClick={() => setTab("mise")}>
          Mises
        </Tab>
      </div>

      {rows.length === 0 ? (
        <p className="surface-card px-4 py-8 text-center text-sm text-mist">
          Pas encore de prono noté.
        </p>
      ) : (
        <div className="section-card overflow-x-auto">
          <table className="ledger-results w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted">
              <tr className="border-b border-line">
                <th className="px-4 py-3 font-medium">Match</th>
                <th className="px-3 py-3 font-medium">Prono</th>
                <th className="px-3 py-3 font-medium">Type</th>
                <th className="px-3 py-3 font-medium">Filet</th>
                <th className="px-3 py-3 font-medium">Score</th>
                <th className="px-3 py-3 font-medium">Gain 100 €</th>
                <th className="px-3 py-3 font-medium">Verdict</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-line/70 transition-colors hover:bg-slate-50/80">
                  <td data-label="Match" className="px-4 py-3">
                    <Link
                      to="/match/$matchId"
                      params={{ matchId: row.matchId }}
                      className="flex items-center gap-2 text-paper hover:underline"
                    >
                      <Crest name={row.home} short={row.home.slice(0, 3)} size={24} />
                      <span>
                        {row.home} – {row.away}
                      </span>
                      <Crest name={row.away} short={row.away.slice(0, 3)} size={24} />
                    </Link>
                    <p className="text-xs text-muted">
                      {format(new Date(row.kickoff), "d MMM HH:mm", { locale: fr })}
                      {row.dailyBest ? " · opportunité du jour" : ""}
                      {" · "}
                      <Link to="/prediction/$predictionId" params={{ predictionId: row.id }} className="text-sage hover:underline">
                        Vérifier
                      </Link>
                    </p>
                  </td>
                  <td data-label="Prono" className="px-3 py-3">
                    {row.label}
                    <p className="text-xs text-muted tabular">
                      {Math.round(row.modelProb * 100)} % · {fmtOdds(row.odds)}
                    </p>
                  </td>
                  <td data-label="Type" className="px-3 py-3 text-xs text-mist">
                    {row.kind === "mise" ? "Mise" : DECISION_LABEL[row.decision] ?? "Prono"}
                  </td>
                  <td data-label="Filet" className="px-3 py-3 text-xs text-mist">
                    {row.filetUsed && row.coverOdds ? (
                      <>
                        {fmtOdds(row.coverOdds)}
                        <p className="text-muted">
                          {row.coverResult === "win"
                            ? `${row.coverScore ?? "score"} · récupéré`
                            : row.coverResult === "lose"
                              ? `pas ${row.coverScore ?? "ça"}`
                              : "en attente"}
                        </p>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td data-label="Score" className="px-3 py-3 tabular text-mist">
                    {row.goalsHome != null && row.goalsAway != null
                      ? `${row.goalsHome}–${row.goalsAway}`
                      : "—"}
                  </td>
                  <td data-label="Résultat simulé · 100 €" className="px-3 py-3 tabular">
                    {row.pnl10 == null ? (
                      <span className="text-muted">—</span>
                    ) : (
                      <span className={row.pnl10 > 0.005 ? "text-sage" : row.pnl10 < -0.005 ? "text-rust" : "text-paper"}>
                        {fmtEur(row.pnl10, true)}
                      </span>
                    )}
                  </td>
                  <td data-label="Verdict" className="px-3 py-3">
                    {row.verdict === "juste" ? (
                      <VerdictBadge verdict="gagnant" />
                    ) : row.verdict === "couvert" ? (
                      <span className="text-paper">Couvert · {row.coverScore ?? "filet"}</span>
                    ) : row.verdict === "faux" ? (
                      <VerdictBadge verdict="perdant" />
                    ) : row.verdict === "void" ? (
                      <VerdictBadge verdict="void" />
                    ) : (
                      <VerdictBadge verdict="attente" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </div>
      </AstraSidewings>
    </>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? "min-h-11 rounded-full bg-sage px-4 text-sm font-semibold text-ink shadow-[0_8px_18px_rgba(124,194,58,0.2)]"
          : "min-h-11 rounded-full border border-line bg-white px-4 text-sm font-semibold text-muted hover:text-paper"
      }
    >
      {children}
    </button>
  );
}

function publicMethodName(engine: string, index: number): string {
  const key = String(engine || "").toLowerCase();
  if (/roi5|canonical|champion/.test(key)) return "Méthode BetGPT principale";
  if (/tact/.test(key)) return "Avec lecture tactique";
  if (/baseline|base/.test(key)) return "Modèle statistique";
  if (/ensemble|blend|mix/.test(key)) return "Combinaison de modèles";
  return `Méthode BetGPT ${index + 1}`;
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-card min-w-0 px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="mt-2 break-words font-display text-lg font-bold tabular text-paper sm:text-2xl">{value}</p>
    </div>
  );
}

/** Data-only evidence chart: every observation is a real row of the canonical archive replay.
 * Never interpolate missing matches, never imply observed bookmaker odds or actual deposited money. */
function HistoricalEquityChart({ rows }: { rows: CanonicalReplayEvidenceRow[] }) {
  if (!rows.length) return <p className="rounded-xl border border-line p-7 text-sm text-muted">Historique indisponible : aucun tracé inventé.</p>;
  const width = 1000;
  const height = 252;
  const left = 14;
  const right = 986;
  const top = 16;
  const bottom = 225;
  const values = [0, ...rows.map((row) => row.cumulativePnl)];
  const low = Math.min(...values, 0);
  const high = Math.max(...values, 0);
  const spread = Math.max(1, high - low);
  const y = (v: number) => bottom - ((v - low) / spread) * (bottom - top);
  const x = (index: number) => left + (index / Math.max(1, values.length - 1)) * (right - left);
  const line = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const zeroY = y(0);
  const lastY = y(values[values.length - 1]!);
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-gradient-to-b from-white to-emerald-50/40 p-3 sm:p-5">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Courbe des résultats historiques cumulés sur ${rows.length} sélections, de zéro à ${values[values.length - 1]!.toFixed(2)} unités`} className="h-auto w-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="betgpt-equity-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#16a34a" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#16a34a" stopOpacity="0.015" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
          const lineY = top + fraction * (bottom - top);
          const level = high - spread * fraction;
          return (
            <g key={fraction}>
              <line x1={left} y1={lineY} x2={right} y2={lineY} stroke="#d4e6dd" strokeDasharray="4 6" />
              <text x={left + 7} y={Math.max(13, lineY - 5)} fontSize="13" fill="#587069">{level.toFixed(0)} u.</text>
            </g>
          );
        })}
        <line x1={left} y1={zeroY} x2={right} y2={zeroY} stroke="#64748b" strokeWidth="1.2" strokeDasharray="6 5" />
        <polygon points={`${left},${bottom} ${line} ${right},${bottom}`} fill="url(#betgpt-equity-fill)" />
        <polyline points={line} stroke="#168759" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" fill="none" vectorEffect="non-scaling-stroke" />
        <circle cx={right} cy={lastY} r="5" fill="#047857" stroke="#ffffff" strokeWidth="2" />
      </svg>
      <div className="mt-1 flex justify-between gap-4 px-2 text-xs text-muted">
        <span>Première sélection</span>
        <span>Dernière sélection · <strong className="text-sage">{fmtEur(values[values.length - 1]! * 100, true)} simulés</strong></span>
      </div>
    </div>
  );
}
