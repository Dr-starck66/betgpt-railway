import { Link } from "@tanstack/react-router";
import type { MatchInput, PredictionRecord } from "@/engine/types";
import { buildMatchIntelligencePanel } from "@/engine/match-intelligence-panel";
import { fmtPct } from "@/lib/utils";
import { ProbBar } from "./meters";

function pct(v: number): string {
  return `${Math.round(v * 100)} %`;
}

function sideLabel(side: "1" | "N" | "2", match: MatchInput): string {
  return side === "1" ? match.home.short : side === "2" ? match.away.short : "Nul";
}

export function MatchIntelligencePanel({
  match,
  prediction,
}: {
  match: MatchInput;
  prediction: PredictionRecord;
}) {
  const view = buildMatchIntelligencePanel(match, prediction);
  const sumOk = Math.abs(view.probabilitySum - 1) < 0.03;

  return (
    <section className="surface-card overflow-hidden border-sage/35" aria-labelledby="match-intelligence-title">
      <div className="border-b border-line bg-sage/5 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sage">BetGPT Match Intelligence</p>
            <h2 id="match-intelligence-title" className="mt-1 text-xl font-semibold tracking-tight text-paper sm:text-2xl">
              Comprendre le match avant le coup d’envoi
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-mist">
              Probabilités calibrées, scénarios conditionnels, buts attendus du modèle, qualité des données et éléments non vérifiés — séparés pour éviter les faux signaux de certitude.
            </p>
          </div>
          <div className="rounded-xl border border-line bg-pitch px-4 py-3 text-right">
            <p className="text-[11px] uppercase tracking-wider text-muted">Confiance globale</p>
            <p className="mt-1 text-2xl font-semibold tabular text-paper">{view.confidence10.toFixed(1)} / 10</p>
            <p className="text-xs font-medium text-sage">{view.confidenceBand}</p>
          </div>
        </div>

        <div className="mt-5">
          <ProbBar
            home={view.calibrated.home}
            draw={view.calibrated.draw}
            away={view.calibrated.away}
            homeLabel={match.home.short}
            awayLabel={match.away.short}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Kpi label="Victoire domicile" value={fmtPct(view.calibrated.home)} />
          <Kpi label="Nul" value={fmtPct(view.calibrated.draw)} />
          <Kpi label="Victoire extérieur" value={fmtPct(view.calibrated.away)} />
          <Kpi label="Plus de 2,5" value={fmtPct(view.calibrated.over25)} />
          <Kpi label="Les deux marquent" value={fmtPct(view.calibrated.bttsYes)} />
        </div>
        {!sumOk ? (
          <p className="mt-3 text-sm text-rust">Alerte intégrité : la somme 1N2 n’est pas correctement normalisée. Cette vue doit être auditée.</p>
        ) : null}
      </div>

      <div className="grid gap-0 lg:grid-cols-[1.05fr_.95fr]">
        <div className="p-5 sm:p-6 lg:border-r lg:border-line">
          <h3 className="font-semibold text-paper">Qualité et accord</h3>
          <p className="mt-1 text-xs text-muted">Ce sont des indicateurs de confiance du pipeline, pas des probabilités de gagner un pari.</p>
          <div className="mt-4 space-y-3">
            {view.metrics.map((m) => (
              <div key={m.key}>
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-mist">{m.label}</span>
                  <span className="tabular text-paper">{pct(m.value)}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-line/70" aria-hidden="true">
                  <div className="h-full rounded-full bg-sage" style={{ width: `${Math.round(m.value * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <Kpi label={`Buts attendus ${match.home.short}`} value={view.expectedGoals.home.toFixed(2)} note="sortie modèle" />
            <Kpi label={`Buts attendus ${match.away.short}`} value={view.expectedGoals.away.toFixed(2)} note="sortie modèle" />
          </div>
          {view.likelyScores.length ? (
            <div className="mt-4 rounded-xl border border-line bg-pitch p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Scores les plus probables</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {view.likelyScores.slice(0, 3).map((s) => (
                  <span key={s.score} className="rounded-full border border-line px-3 py-1.5 text-sm tabular text-paper">
                    {s.score} · {fmtPct(s.p)}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="p-5 sm:p-6">
          <h3 className="font-semibold text-paper">Preuves disponibles</h3>
          {view.evidence.length ? (
            <ul className="mt-3 grid gap-2 text-sm text-mist">
              {view.evidence.slice(0, 7).map((item) => (
                <li key={item} className="rounded-lg border border-line bg-pitch px-3 py-2">✓ {item}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-rust">Aucune preuve détaillée disponible dans ce snapshot.</p>
          )}

          <h3 className="mt-6 font-semibold text-paper">Inconnu / non vérifié</h3>
          {view.unknown.length ? (
            <ul className="mt-3 space-y-2 text-sm text-clay">
              {view.unknown.slice(0, 6).map((item) => (
                <li key={item}>— {item}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-mist">Aucun manque critique signalé par le pipeline sur ce snapshot.</p>
          )}
        </div>
      </div>

      {view.scenarios.length ? (
        <div className="border-t border-line p-5 sm:p-6">
          <h3 className="font-semibold text-paper">Scénarios conditionnels</h3>
          <p className="mt-1 text-xs text-muted">
            Chaque carte montre comment le 1N2 se redistribue si ce scénario survient. Le pourcentage affiché n’est pas la probabilité que le scénario survienne.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {view.scenarios.map((s) => (
              <article key={s.id} className="rounded-xl border border-line bg-pitch p-4">
                <div className="flex items-start justify-between gap-3">
                  <h4 className="font-medium text-paper">{s.label}</h4>
                  <span className="rounded-full border border-line px-2 py-1 text-[11px] font-semibold text-sage">
                    avantage {sideLabel(s.dominant, match)} {fmtPct(s.dominantProbability)}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-mist">{s.description}</p>
                <div className="mt-3">
                  <ProbBar home={s.home} draw={s.draw} away={s.away} homeLabel={match.home.short} awayLabel={match.away.short} />
                </div>
                <p className="mt-2 text-xs text-muted">+2,5 {fmtPct(s.over25)} · BTTS {fmtPct(s.bttsYes)}</p>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-raised/50 px-5 py-4 sm:px-6">
        <p className="text-xs text-muted">Les pertes restent visibles et la calibration est suivie sur l’historique public.</p>
        <div className="flex flex-wrap gap-3 text-sm font-semibold">
          <Link to="/ledger" className="text-sage hover:underline">Historique public</Link>
          <Link to="/rapports/precision" className="text-sage hover:underline">Rapport de précision</Link>
        </div>
      </div>
    </section>
  );
}

function Kpi({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border border-line bg-pitch px-3 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular text-paper">{value}</p>
      {note ? <p className="mt-0.5 text-[10px] text-muted">{note}</p> : null}
    </div>
  );
}
