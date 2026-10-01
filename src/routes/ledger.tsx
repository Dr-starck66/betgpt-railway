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
import { SITE_URL } from "@/lib/seo";

export const Route = createFileRoute("/ledger")({
  loader: () => getLedgerDesk(),
  head: () => ({
    meta: [
      { title: "Bilan et historique des pronostics football | BetGPT" },
      {
        name: "description",
        content:
          "Bilan transparent des pronostics BetGPT : paris publiés, gagnants et perdants, simulations historiques et détail match par match.",
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
  const engineN = data.historyN ?? 0;
  const engineReady = engineN >= 30 && Boolean(best && best.brier > 0);

  const rows = useMemo(() => {
    if (tab === "mise") return r.rows.filter((x) => x.kind === "mise");
    if (tab === "soon") return r.rows.filter((x) => x.kind !== "mise" && !x.result);
    return r.rows.filter((x) => x.kind !== "mise" && (x.result === "win" || x.result === "lose"));
  }, [r.rows, tab]);

  return (
    <div className="space-y-8">
      <section className="hero-panel p-6 sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div>
            <p className="eyebrow">Transparence & performance</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">Bilan BetGPT</h1>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-mist sm:text-lg">
              Pronos 1-N-2 ou marché réellement misé. Le pari complémentaire sur le score exact reste affiché séparément. Les pertes
              restent visibles : aucun historique n’est nettoyé après coup. {asOf ? `Scores à ${asOf}.` : ""}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="chip-pill">Historique public</span>
              <span className="chip-pill">Pertes conservées</span>
              <span className="chip-pill">Méthode expliquée</span>
            </div>
          </div>
          <aside className="surface-card p-5">
            <p className="text-sm font-semibold text-paper">Lecture correcte</p>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-mist">
              <li>• Les résultats réels et les simulations sont séparés.</li>
              <li>• Le ROI affiché suit les hypothèses indiquées.</li>
              <li>• Un petit échantillon reste explicitement signalé.</li>
            </ul>
          </aside>
        </div>
      </section>

      <section className="section-card border-sage/40 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Notre meilleure méthode historique</p>
            <h2 className="mt-1 font-display text-2xl">Ce que le test historique a réellement donné</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-mist">
              Nous avons rejoué la méthode actuelle match après match, sans utiliser le résultat final
              à l’avance. Sur cet historique, elle affiche {fmtSignedPct(canonical.summary.roi)} de
              rendement simulé. Ce n’est ni un bénéfice réellement encaissé, ni une promesse pour les
              prochains paris.
            </p>
          </div>
          <span className="chip-pill">Méthode utilisée aujourd’hui</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="Rendement du test" value={fmtSignedPct(canonical.summary.roi)} />
          <Kpi label="Test final" value={fmtSignedPct(canonical.summary.validationRoi)} />
          <Kpi label="Paris testés" value={String(canonical.summary.n)} />
          <Kpi label="Pire recul" value={`${canonical.summary.maxDrawdown.toFixed(2)} mises`} />
        </div>
        <p className="mt-3 text-xs text-muted">
          Sur les {canonical.summary.validationN} paris gardés pour le test final :{" "}
          {fmtSignedPct(canonical.summary.validationRoi)} de rendement simulé, avec une plus forte baisse
          de {canonical.summary.validationMaxDrawdown.toFixed(2)} mises. Résultats historiques uniquement.
        </p>
      </section>

      <section className="section-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Match par match</p>
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
          <Kpi label="Victoires" value={String(canonical.summary.wins)} />
          <Kpi label="Défaites" value={String(canonical.summary.losses)} />
          <Kpi label="Taux de réussite" value={`${Math.round(canonical.summary.hitRate * 100)} %`} />
          <Kpi label="Protections réussies" value={`${canonical.summary.hedgeHits}/${canonical.summary.hedges}`} />
          <Kpi label="Bilan simulé" value={`${canonical.summary.profit >= 0 ? "+" : ""}${canonical.summary.profit.toFixed(2)} unités`} />
        </div>

        <div className="mt-4 overflow-x-auto">
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
                <th className="py-2 pr-3 font-medium">Gain / perte</th>
                <th className="py-2 pr-3 font-medium">Total</th>
                <th className="py-2 pr-3 font-medium">Phase du test</th>
              </tr>
            </thead>
            <tbody>
              {canonicalRows.map((row) => (
                <tr key={row.id} className="border-b border-line/50 align-top">
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
                    <span className="chip-pill">{row.result === "win" ? "Gagné" : "Perdu"}</span>
                  </td>
                  <td className="py-3 pr-3 text-xs text-mist">
                    {row.hedge
                      ? `${row.hedge.score} à ${row.hedge.odds.toFixed(2)} · ${row.hedge.stake.toFixed(2)} u · ${row.hedge.hit ? "réussi" : "raté"}`
                      : "—"}
                  </td>
                  <td className="py-3 pr-3 tabular">
                    {row.pnl >= 0 ? "+" : ""}{row.pnl.toFixed(2)} u
                  </td>
                  <td className="py-3 pr-3 tabular">
                    {row.cumulativePnl >= 0 ? "+" : ""}{row.cumulativePnl.toFixed(2)} u
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
            Les gains et pertes sont affichés en unités : 1 unité correspond à la mise principale du test.
            Un petit pari complémentaire sur un score exact peut s’ajouter quand la méthode le prévoit. Les matchs les plus
            récents sont affichés en premier.
          </p>
        </div>
      </section>

      {ev ? (
        <section className="section-card p-5 sm:p-6">
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

      <section className="section-card border-sage/40 p-5 sm:p-6">
        <h2 className="font-display text-xl">Et si on avait misé 100 € sur chaque pari publié ?</h2>
        <p className="mt-1 text-sm text-mist">
          Cette simulation applique 100 € à chaque pari réellement retenu par BetGPT. Les matchs
          simplement surveillés ou écartés ne sont pas ajoutés artificiellement au bilan.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="Paris simulés" value={String(r.sim.n)} />
          <Kpi label="100 € par pari" value={`${fmtEur(r.sim.mainStaked)} → ${fmtEur(r.sim.mainReturned)}`} />
          <Kpi
            label={`Protections score exact · ${r.sim.covered}`}
            value={`${fmtEur(r.sim.coverStaked)} → ${fmtEur(r.sim.coverReturned)}`}
          />
          <Kpi label="Bilan simulé" value={fmtEur(r.sim.profit, true)} />
        </div>
        {r.sim.n ? (
          <p className="mt-3 text-sm text-paper">
            Sans protection : {fmtEur(r.sim.mainReturned - r.sim.mainStaked, true)}. Avec protection : {fmtEur(r.sim.profit, true)} ({fmtSignedPct(r.sim.roi)}). {r.sim.hits} gagnants, {r.sim.covered} couverts, {r.losses} perdants.
          </p>
        ) : (
          <p className="mt-3 text-sm text-paper">Pas encore de match tranché pour la simu.</p>
        )}
        {r.misePending ? (
          <p className="mt-2 text-sm text-mist">
            {r.misePending} mise{r.misePending > 1 ? "s" : ""} encore à jouer
            {r.miseSettled ? ` · ${r.miseHits}/${r.miseSettled} déjà tranchée${r.miseSettled > 1 ? "s" : ""}` : ""}.
          </p>
        ) : null}
      </section>

      {data.archive ? (
        <section className="section-card border-sage/40 p-5 sm:p-6">
          <h2 className="font-display text-xl">Test historique sur les anciennes saisons</h2>
          <p className="mt-1 text-sm text-mist">
            La méthode actuelle a été rejouée dans l’ordre sur {data.archive.n} anciens matchs
            ({data.archive.years}). Ce test est séparé des pronostics réellement publiés et ne garantit
            aucun résultat futur.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Pronos justes" value={`${Math.round(data.archive.acc * 100)} %`} />
            <Kpi label="Résultat simulé · 100 €" value={data.archive.profit == null ? "Indisponible" : fmtEur(data.archive.profit, true)} />
            <Kpi label="Rendement simulé" value={data.archive.roi == null ? "Indisponible" : fmtSignedPct(data.archive.roi)} />
            <Kpi label="Matchs" value={String(data.archive.n)} />
          </div>
          <ul className="mt-4 space-y-1.5 text-sm text-mist">
            {data.archive.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          {data.archive.byLeague.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
                <tr className="border-b border-line">
                  <th className="py-2 pr-3 font-medium">Compétition</th>
                  <th className="py-2 pr-3 font-medium">Matchs</th>
                  <th className="py-2 pr-3 font-medium">Pronos justes</th>
                  <th className="py-2 pr-3 font-medium">Bénéfice net · 100 €</th>
                </tr>
              </thead>
              <tbody>
                {data.archive.byLeague.map((lg) => (
                  <tr key={lg.league} className="border-b border-line/50">
                    <td className="py-2 pr-3 text-paper">{LEAGUE_LABEL[lg.league] ?? lg.league}</td>
                    <td className="py-2 pr-3 tabular">{lg.n}</td>
                    <td className="py-2 pr-3 tabular">{Math.round(lg.acc * 100)} %</td>
                    <td className="py-2 pr-3 tabular text-paper">
                      {lg.profit == null ? "Indisponible" : fmtEur(lg.profit, true)}
                      <span className="ml-1 text-mist">{lg.roi == null ? "—" : fmtSignedPct(lg.roi)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          ) : null}
        </section>
      ) : (
        <p className="text-sm text-mist">Test historique indisponible.</p>
      )}

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
