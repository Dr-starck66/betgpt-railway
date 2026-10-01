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
          "Bilan du champion canonique ROI5 BetGPT : résultats réels des BET, replay chronologique, validation et historique transparent.",
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
              Pronos 1-N-2 ou marché réellement misé. Le score exact reste un filet séparé. Les pertes
              restent visibles : aucun historique n’est nettoyé après coup. {asOf ? `Scores à ${asOf}.` : ""}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="chip-pill">Historique public</span>
              <span className="chip-pill">Pertes conservées</span>
              <span className="chip-pill">Calibration visible</span>
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
            <p className="eyebrow">Champion canonique ROI5</p>
            <h2 className="mt-1 font-display text-2xl">Méthode validée &gt; 30 %</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-mist">
              Benchmark rétrospectif chronologique du gate canonique actuellement appliqué aux
              décisions de production. Il est séparé du registre public réel ci-dessous : ce
              dernier conserve tous les résultats observés et ne doit jamais être réécrit pour
              reproduire artificiellement le backtest.
            </p>
          </div>
          <span className="chip-pill">Gate production actif</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="ROI canonique" value={fmtSignedPct(canonical.summary.roi)} />
          <Kpi label="Validation chronologique" value={fmtSignedPct(canonical.summary.validationRoi)} />
          <Kpi label="Échantillon canonique" value={String(canonical.summary.n)} />
          <Kpi label="Drawdown max" value={canonical.summary.maxDrawdown.toFixed(2)} />
        </div>
        <p className="mt-3 text-xs text-muted">
          Validation : {canonical.summary.validationN} sélections · drawdown max{" "}
          {canonical.summary.validationMaxDrawdown.toFixed(2)}. Performance historique,
          non garantie pour les prochains paris.
        </p>
      </section>

      <section className="section-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Preuve match par match</p>
            <h2 className="mt-1 font-display text-2xl">Les {canonical.summary.n} sélections derrière le bilan</h2>
            <p className="mt-2 max-w-4xl text-sm leading-relaxed text-mist">
              Chaque ligne correspond à une sélection réellement incluse dans le replay chronologique du
              champion ROI5. Le score final vient de l’archive historique. La cote affichée est la cote
              synthétique/reconstruite utilisée par le replay, et non une cote bookmaker horodatée.
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
          <Kpi label="Hits" value={`${Math.round(canonical.summary.hitRate * 100)} %`} />
          <Kpi label="Couvertures" value={`${canonical.summary.hedgeHits}/${canonical.summary.hedges}`} />
          <Kpi label="Profit" value={`${canonical.summary.profit >= 0 ? "+" : ""}${canonical.summary.profit.toFixed(2)} u`} />
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1120px] text-sm">
            <thead className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
              <tr className="border-b border-line">
                <th className="py-2 pr-3 font-medium">#</th>
                <th className="py-2 pr-3 font-medium">Date</th>
                <th className="py-2 pr-3 font-medium">Match</th>
                <th className="py-2 pr-3 font-medium">Pari</th>
                <th className="py-2 pr-3 font-medium">Cote*</th>
                <th className="py-2 pr-3 font-medium">Score</th>
                <th className="py-2 pr-3 font-medium">Résultat</th>
                <th className="py-2 pr-3 font-medium">Couverture</th>
                <th className="py-2 pr-3 font-medium">P&L</th>
                <th className="py-2 pr-3 font-medium">Cumul</th>
                <th className="py-2 pr-3 font-medium">Validation</th>
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
                    <div className="font-medium text-paper">{row.home} – {row.away}</div>
                    <div className="mt-1 text-xs text-muted">{LEAGUE_LABEL[row.league] ?? row.league}</div>
                  </td>
                  <td className="py-3 pr-3 text-paper">
                    {row.market === "1X2_H" ? "1" : "2"} · {row.selection}
                  </td>
                  <td className="py-3 pr-3 tabular">{row.odds.toFixed(2)}</td>
                  <td className="py-3 pr-3 tabular font-medium text-paper">{row.score}</td>
                  <td className="py-3 pr-3">
                    <span className="chip-pill">{row.result === "win" ? "WIN" : "LOSS"}</span>
                  </td>
                  <td className="py-3 pr-3 text-xs text-mist">
                    {row.hedge
                      ? `${row.hedge.score} @ ${row.hedge.odds.toFixed(2)} · ${row.hedge.stake.toFixed(2)} u · ${row.hedge.hit ? "HIT" : "MISS"}`
                      : "—"}
                  </td>
                  <td className="py-3 pr-3 tabular">
                    {row.pnl >= 0 ? "+" : ""}{row.pnl.toFixed(2)} u
                  </td>
                  <td className="py-3 pr-3 tabular">
                    {row.cumulativePnl >= 0 ? "+" : ""}{row.cumulativePnl.toFixed(2)} u
                  </td>
                  <td className="py-3 pr-3 text-xs text-mist">{row.validation20 ? "20 % final" : "Développement"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 space-y-1 text-xs leading-relaxed text-muted">
          <p>* {canonical.oddsDisclosure}</p>
          <p>{canonical.scoreDisclosure}</p>
          <p>
            P&L en unités normalisées : 1 u sur le pari principal, plus la petite couverture exacte
            lorsqu’elle est sélectionnée par la règle canonique. Les lignes sont affichées des plus récentes
            aux plus anciennes ; le cumul reste calculé dans l’ordre chronologique du replay.
          </p>
        </div>
      </section>

      {ev ? (
        <section className="section-card p-5 sm:p-6">
          <h2 className="font-display text-xl">Résultats réels du champion canonique</h2>
          <p className="mt-1 text-sm text-mist">
            Le calcul ne retient ici que les BET 1-N-2 domicile/extérieur produits par la version
            canonique ROI5 et enregistrés avant le coup d’envoi. WATCH, NO_BET et anciennes
            versions restent hors du ROI du champion. {ev.sampleLabel}.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Publiés" value={String(ev.published)} />
            <Kpi label="Avant coup d'envoi" value={String(ev.beforeKickoff)} />
            <Kpi label="Tranchés (éligibles)" value={String(ev.settled)} />
            <Kpi
              label="ROI théorique (1 u)"
              value={ev.roi == null ? "Non vérifié" : fmtSignedPct(ev.roi)}
            />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi
              label="Taux de hits"
              value={ev.winRate == null ? "Non vérifié" : `${Math.round(ev.winRate * 100)} %`}
            />
            <Kpi
              label="Brier"
              value={ev.brier == null ? "Non vérifié" : ev.brier.toFixed(3)}
            />
            <Kpi label="Pertes conservées" value={String(ev.losses)} />
            <Kpi label="Après coup d'envoi (exclus)" value={String(ev.afterKickoff)} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi
              label="Attendu vs observé"
              value={
                ev.settled && ev.expectedHits != null
                  ? `${ev.expectedHits.toFixed(1)} → ${ev.observedHits}`
                  : "Non vérifié"
              }
            />
            <Kpi
              label="CLV"
              value={ev.clv == null ? "Indisponible" : fmtSignedPct(ev.clv)}
            />
            <Kpi
              label="Drawdown max"
              value={ev.maxDrawdown == null ? "Non vérifié" : ev.maxDrawdown.toFixed(2)}
            />
            <Kpi label="Série + / −" value={`${ev.longestWin} / ${ev.longestLose}`} />
          </div>
          <p className="mt-3 text-xs text-muted">
            ROI = (unités rentrées − unités mises) / unités mises, 1 unité par BET canonique éligible.
            WATCH et NO_BET ne comptent jamais comme mises. Ce calcul ne mesure pas des mises réellement exécutées.
            Le filet (score exact, 50 % de la mise) est une simulation séparée, pas le registre.
            {ev.unavailable.length ? ` Indisponible : ${ev.unavailable.join(", ")}.` : ""}
          </p>
          {ev.calibration.some((b) => b.n > 0) ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
                  <tr className="border-b border-line">
                    <th className="py-2 pr-3 font-medium">Prob. annoncée</th>
                    <th className="py-2 pr-3 font-medium">n</th>
                    <th className="py-2 pr-3 font-medium">Observé</th>
                    <th className="py-2 pr-3 font-medium">Échantillon</th>
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
                    <th className="py-2 pr-3 font-medium">Moteur</th>
                    <th className="py-2 pr-3 font-medium">n</th>
                    <th className="py-2 pr-3 font-medium">Brier</th>
                    <th className="py-2 pr-3 font-medium">ROI</th>
                    <th className="py-2 pr-3 font-medium">Hits</th>
                    <th className="py-2 pr-3 font-medium">Échantillon</th>
                  </tr>
                </thead>
                <tbody>
                  {ev.models.map((m) => (
                    <tr key={m.engine} className="border-b border-line/50">
                      <td className="py-2 pr-3 text-paper">{m.engine}</td>
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
            <p className="mt-3 text-sm text-mist">Comparaison des moteurs : données non collectées sur l’historique hérité.</p>
          )}
        </section>
      ) : null}

      {r.clNight ? <CupNight night={r.clNight} /> : null}

      <section className="section-card border-sage/40 p-5 sm:p-6">
        <h2 className="font-display text-xl">Bilan réel du champion · 100 € par BET</h2>
        <p className="mt-1 text-sm text-mist">
          100 € simulés uniquement sur les BET du champion canonique. Le filet reste une couverture
          séparée et ne transforme jamais un WATCH ou un NO_BET en mise.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="Matchs" value={String(r.sim.n)} />
          <Kpi label="Pronos 100 €" value={`${fmtEur(r.sim.mainStaked)} → ${fmtEur(r.sim.mainReturned)}`} />
          <Kpi
            label={`Filets · ${r.sim.covered} fois`}
            value={`${fmtEur(r.sim.coverStaked)} → ${fmtEur(r.sim.coverReturned)}`}
          />
          <Kpi label="Bilan total" value={fmtEur(r.sim.profit, true)} />
        </div>
        {r.sim.n ? (
          <p className="mt-3 text-sm text-paper">
            Sans filet : {fmtEur(r.sim.mainReturned - r.sim.mainStaked, true)}. Avec filet : {fmtEur(r.sim.profit, true)} ({fmtSignedPct(r.sim.roi)}). {r.sim.hits} gagnants, {r.sim.covered} couverts, {r.losses} perdants.
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
          <h2 className="font-display text-xl">Replay chronologique du champion canonique</h2>
          <p className="mt-1 text-sm text-mist">
            {data.archive.n} sélections du replay canonique ({data.archive.years}). Ce benchmark
            chronologique est distinct des résultats réels publiés et ne garantit aucun rendement futur.
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
        <p className="text-sm text-mist">Replay canonique indisponible.</p>
      )}

      <section className="section-card p-5 sm:p-6">
        <h2 className="font-display text-xl">Comparaison sur les archives</h2>
        <p className="mt-2 text-sm text-mist">
          Testé sur {engineN} matchs d'archive. Plus l'erreur est basse, mieux c'est.
        </p>
        {engineReady && best ? (
          <p className="mt-3 text-paper">
            Meilleur moteur : {MODEL_LABEL[best.name] ?? best.name}. Erreur {best.brier.toFixed(3)}.
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
            Erreur chiffres {base.brier.toFixed(3)} · avec lecture du match {tac.brier.toFixed(3)}
            {r.clv ? ` · CLV ticket ${fmtSignedPct(r.clv)}` : ""}
          </p>
        ) : null}
      </section>

      <section className="section-card p-5 sm:p-6">
        <h2 className="font-display text-xl">Le desk apprend</h2>
        <p className="mt-1 text-sm text-mist">
          Recalage des probabilités et règles tirées des résultats enregistrés.
          Leur utilité doit être évaluée sur des matchs ultérieurs, sans réécrire l'historique.
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

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-card min-w-0 px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="mt-2 break-words font-display text-lg font-bold tabular text-paper sm:text-2xl">{value}</p>
    </div>
  );
}
