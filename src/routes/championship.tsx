import { createFileRoute } from "@tanstack/react-router";
import { getChampionshipDesk } from "@/lib/desk.functions";
import { AGENT_LABEL, ALL_LEAGUES, LEAGUE_LABEL, MODEL_LABEL } from "@/lib/labels";
import { SITE_URL } from "@/lib/seo";
import { fmtPct, fmtSignedPct } from "@/lib/utils";
import type { CoachAgentId, ModelMetric } from "@/engine/types";
import { pickDeployable, scoreboardOf } from "@/engine/benchmark";

export const Route = createFileRoute("/championship")({
  loader: () => getChampionshipDesk(),
  head: () => ({
    meta: [
      { title: "Championnat des modèles BetGPT (interne)" },
      { name: "robots", content: "noindex, follow" },
      { name: "googlebot", content: "noindex, follow" },
      { name: "description", content: "Page interne de comparaison des modèles BetGPT. Pas un championnat de football. Non indexée." },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/championship` }],
  }),
  component: ChampionshipPage,
});

function ChampionshipPage() {
  const data = Route.useLoaderData();
  const c = data.championship;
  const board = scoreboardOf(c);
  const deploy = pickDeployable(c);
  const ranked = board.ranked;
  const leagues = ALL_LEAGUES;
  const agents = Object.keys(c.agentLeague) as CoachAgentId[];
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl tracking-tight">Championnat des modèles</h1>
        <p className="mt-1 max-w-2xl text-sm text-mist">
          Testé sur {data.historyN} vrais résultats. Brier et LogLoss d'abord, taux de hits ensuite.{" "}
          {board.roiLabel} Fiabilité actuelle : {fmtPct(data.reliability)}.
        </p>
        <p className="mt-2 text-sm text-paper">{deploy.reason}</p>
      </header>
      <Board rows={ranked} />
      <section>
        <h2 className="mb-3 font-display text-2xl">Ablation</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {c.ablation.map((a) => (
            <div key={a.name} className="rounded-xl border border-line bg-surface p-4">
              <p className="text-xs uppercase tracking-widest text-muted">{a.name}</p>
              <p className="mt-2 font-display text-2xl tabular">{a.brier.toFixed(3)}</p>
              <p className="text-xs text-muted">Brier · n={a.n}</p>
              <dl className="mt-3 space-y-1 text-sm">
                <Line k="LogLoss" v={a.logLoss.toFixed(3)} />
                <Line k="ROI" v={fmtSignedPct(a.roi)} />
                <Line k="CLV" v={a.clv.toFixed(3)} />
                <Line k="Hit" v={fmtPct(a.hitRate)} />
              </dl>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-3 font-display text-2xl">Coachs par ligue</h2>
        <p className="mb-3 text-sm text-mist">
          Qui aide vraiment, ligue par ligue. Un angle peut marcher en Liga et rater en Premier League.
        </p>
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted">
              <tr className="border-b border-line">
                <th className="px-4 py-3 font-medium">Agent</th>
                {leagues.map((lg) => (
                  <th key={lg} className="px-3 py-3 font-medium">
                    {LEAGUE_LABEL[lg]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {agents.map((id) => (
                <tr key={id} className="border-b border-line/60">
                  <td className="px-4 py-3">{AGENT_LABEL[id].title}</td>
                  {leagues.map((lg) => (
                    <td key={lg} className="px-3 py-3 tabular">
                      {c.agentLeague[id][lg] ? c.agentLeague[id][lg]!.toFixed(2) : "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Board({ rows }: { rows: ModelMetric[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="text-left text-xs uppercase tracking-wider text-muted">
          <tr className="border-b border-line">
            <th className="px-4 py-3 font-medium">Compétiteur</th>
            <th className="px-3 py-3 font-medium">n</th>
            <th className="px-3 py-3 font-medium">Brier</th>
            <th className="px-3 py-3 font-medium">LogLoss</th>
            <th className="px-3 py-3 font-medium">Hit</th>
            <th className="px-3 py-3 font-medium">CLV</th>
            <th className="px-3 py-3 font-medium">ROI</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.name} className="border-b border-line/60">
              <td className="px-4 py-3">
                <span className="mr-2 text-muted">{i + 1}</span>
                {MODEL_LABEL[r.name] ?? r.name}
              </td>
              <td className="px-3 py-3 tabular">{r.n}</td>
              <td className="px-3 py-3 tabular">{r.brier.toFixed(3)}</td>
              <td className="px-3 py-3 tabular">{r.logLoss.toFixed(3)}</td>
              <td className="px-3 py-3 tabular">{fmtPct(r.hitRate)}</td>
              <td className="px-3 py-3 tabular">{r.clv.toFixed(3)}</td>
              <td className="px-3 py-3 tabular">{fmtSignedPct(r.roi)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted">{k}</span>
      <span className="tabular text-paper">{v}</span>
    </div>
  );
}
