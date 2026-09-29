import { useState } from "react";
import type { MatchInput, PredictionRecord } from "@/engine/types";
import type { PredictionVersion } from "@/engine/intel-types";
import { ProbBar } from "./meters";
import { fmtPct } from "@/lib/utils";
import { formatParis, matchClock } from "@/lib/match-clock";

function signedPp(x: number): string {
  const v = Math.round(x * 1000) / 10;
  const s = v > 0 ? "+" : "";
  return `${s}${v.toFixed(1).replace(".", ",")} pts`;
}

export function LivePrediction({
  match,
  prediction,
  versions = [],
}: {
  match: MatchInput;
  prediction: PredictionRecord;
  versions?: PredictionVersion[];
}) {
  const [open, setOpen] = useState(false);
  const live = prediction.live;
  const p = prediction.calibrated;
  const last = versions[versions.length - 1];
  const prev = versions.length > 1 ? versions[versions.length - 2] : null;
  const clock = matchClock({ kickoff: match.kickoff, predictionAt: prediction.timestamp, versions });
  const when = clock.modified ? formatParis(clock.modified) : "horodatage indisponible";
  const conf = live?.confidence10 ?? Math.round((prediction.intelligence.confidenceScore ?? 0) * 10);
  const delta = live?.valueDelta;
  const why =
    last && last.version > 1
      ? last.reasonForChange
      : null;

  return (
    <section className="rounded-xl border border-sage/40 bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-sage">Pronostic live BetGPT</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">
            {match.home.name} – {match.away.name}
          </h2>
        </div>
        <p className="text-xs text-muted">Mis à jour le {when}</p>
      </div>

      <div className="mt-4">
        <ProbBar
          home={p.home}
          draw={p.draw}
          away={p.away}
          homeLabel={match.home.short}
          awayLabel={match.away.short}
        />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-md border border-line bg-pitch px-3 py-2">
          <dt className="text-[11px] uppercase tracking-wider text-muted">Confiance</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular text-paper">{conf.toFixed(1)} / 10</dd>
        </div>
        <div className="rounded-md border border-line bg-pitch px-3 py-2">
          <dt className="text-[11px] uppercase tracking-wider text-muted">Fraîcheur</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular text-paper">{clock.freshnessLabel}</dd>
        </div>
        <div className="rounded-md border border-line bg-pitch px-3 py-2">
          <dt className="text-[11px] uppercase tracking-wider text-muted">Version</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular text-paper">v{last?.version ?? 1}</dd>
        </div>
        <div className="rounded-md border border-line bg-pitch px-3 py-2">
          <dt className="text-[11px] uppercase tracking-wider text-muted">Score probable</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular text-paper">
            {live?.likelyScores?.[0]
              ? `${live.likelyScores[0].score} · ${fmtPct(live.likelyScores[0].p)}`
              : "—"}
          </dd>
        </div>
      </dl>

      {delta ? (
        <p className="mt-3 text-sm text-mist">
          Écart vs marché (fair) : domicile {signedPp(delta.home)} · nul {signedPp(delta.draw)} · extérieur{" "}
          {signedPp(delta.away)}. Pas un gain garanti.
        </p>
      ) : (
        <p className="mt-3 text-sm text-mist">Marché consensus : indisponible sur ce match.</p>
      )}

      {live?.oddsConflicts?.length ? (
        <p className="mt-2 text-sm text-clay">
          Les books ne sont pas d’accord
          {live.oddsConflicts[0]
            ? ` (${live.oddsConflicts[0].bookA} vs ${live.oddsConflicts[0].bookB})`
            : ""}
          . BetGPT n’en choisit pas un en silence.
        </p>
      ) : null}

      {why ? (
        <div className="mt-4 rounded-md border border-line bg-pitch px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Pourquoi le prono a bougé</p>
          <p className="mt-1 text-sm text-paper">{why}</p>
          {prev ? (
            <p className="mt-1 text-xs text-mist">
              Avant : {fmtPct(prev.homeProbability)} / {fmtPct(prev.drawProbability)} / {fmtPct(prev.awayProbability)}
              {" → "}
              {fmtPct(p.home)} / {fmtPct(p.draw)} / {fmtPct(p.away)}
            </p>
          ) : null}
        </div>
      ) : null}

      {live?.likelyScores?.length ? (
        <p className="mt-3 text-sm text-mist">
          Scores les plus probables :{" "}
          {live.likelyScores.map((s) => `${s.score} (${fmtPct(s.p)})`).join(" · ")}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-4 min-h-11 text-sm font-semibold text-sage"
      >
        {open ? "Masquer le détail" : "Voir la trace"}
      </button>
      {open ? (
        <div className="mt-3 space-y-3 text-sm text-mist">
          {live?.uncertainty?.length ? (
            <p>Inconnu / non vérifié : {live.uncertainty.join(" · ")}</p>
          ) : null}
          <p>
            Buts attendus (modèle, pas un xG observé) :{" "}
            {(live?.expectedGoals.home ?? prediction.ensemble.lambdaHome).toFixed(2)} –{" "}
            {(live?.expectedGoals.away ?? prediction.ensemble.lambdaAway).toFixed(2)}
          </p>
          {live?.components ? (
            <ul className="grid grid-cols-2 gap-1 sm:grid-cols-4">
              <li>Données {Math.round(live.components.dataCompleteness * 100)} %</li>
              <li>Fraîcheur {Math.round(live.components.dataFreshness * 100)} %</li>
              <li>Sources {Math.round(live.components.sourceAgreement * 100)} %</li>
              <li>Modèles {Math.round(live.components.modelAgreement * 100)} %</li>
            </ul>
          ) : null}
          {versions.length > 1 ? (
            <ol className="space-y-1">
              {versions.map((v) => (
                <li key={v.predictionId} className="tabular">
                  v{v.version} · {new Date(v.timestamp).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  {" · "}
                  {fmtPct(v.homeProbability)} / {fmtPct(v.drawProbability)} / {fmtPct(v.awayProbability)}
                  {" · "}
                  {v.reasonForChange}
                </li>
              ))}
            </ol>
          ) : (
            <p>Une seule version publiée. Elle restera visible si le prono bouge.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
