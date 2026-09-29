import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getDesk } from "@/lib/desk.functions";
import { AGENT_LABEL } from "@/lib/labels";
import { fmtPct } from "@/lib/utils";

export const Route = createFileRoute("/lab")({
  loader: () => getDesk(),
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { name: "googlebot", content: "noindex, follow" },
    ],
  }),
  component: LabPage,
});

function LabPage() {
  const data = Route.useLoaderData();
  const wf = data.championship.walkForward.map((f) => ({
    fold: f.fold,
    Baseline: Number(f.brierBase.toFixed(3)),
    Tactique: Number(f.brierTactical.toFixed(3)),
  }));
  const weights = Object.entries(data.agentWeights).map(([k, v]) => ({
    name: AGENT_LABEL[k as keyof typeof AGENT_LABEL].title.split(" ")[0],
    poids: Number((v * 100).toFixed(1)),
  }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl tracking-tight">Labo</h1>
        <p className="mt-1 max-w-2xl text-sm text-mist">
          Tests en conditions réelles. La lecture du match ne pèse que {fmtPct(data.reliability)}
          — et seulement si elle a déjà servi. Diagnostic crawl :{" "}
          <a href="/geo-health" className="text-sage">
            santé SEO / GEO
          </a>
          .
        </p>
      </header>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="font-display text-xl">Erreur dans le temps</h2>
        <p className="mb-4 text-xs text-muted">Plus bas = mieux. Trois tests sur des matchs jamais vus.</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={wf}>
              <CartesianGrid stroke="var(--color-line)" vertical={false} />
              <XAxis dataKey="fold" stroke="var(--color-muted)" fontSize={12} />
              <YAxis stroke="var(--color-muted)" fontSize={12} domain={["auto", "auto"]} />
              <Tooltip
                contentStyle={{
                  background: "var(--color-raised)",
                  border: "1px solid var(--color-line)",
                  color: "var(--color-paper)",
                }}
              />
              <Legend />
              <Bar dataKey="Baseline" fill="var(--color-mist)" radius={4} />
              <Bar dataKey="Tactique" fill="var(--color-sage)" radius={4} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="font-display text-xl">Poids de chaque lecture</h2>
        <p className="mb-4 text-xs text-muted">
          Ce qui a déjà marché + ce qui compte pour ce match-là.
        </p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weights} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid stroke="var(--color-line)" horizontal={false} />
              <XAxis type="number" stroke="var(--color-muted)" fontSize={12} />
              <YAxis type="category" dataKey="name" stroke="var(--color-muted)" fontSize={12} width={90} />
              <Tooltip
                contentStyle={{
                  background: "var(--color-raised)",
                  border: "1px solid var(--color-line)",
                  color: "var(--color-paper)",
                }}
              />
              <Bar dataKey="poids" fill="var(--color-paper)" radius={4} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface p-5 text-sm text-mist space-y-2">
        <h2 className="font-display text-xl text-paper">Protocole</h2>
        <p>
          On entraîne sur le passé, on teste sur la suite. Jamais l'inverse. L'explication
          arrive après la décision : elle ne vote pas.
        </p>
        <p>
          Si la lecture du match n'améliore pas les pronos, on la baisse toute seule. Pas de
          joli récit pour forcer une mise du jour.
        </p>
      </section>
    </div>
  );
}
