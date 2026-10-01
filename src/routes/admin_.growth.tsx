import { createFileRoute } from "@tanstack/react-router";
import { getNationalBreakout } from "@/lib/growth.functions";

export const Route = createFileRoute("/admin_/growth")({
  loader: () => getNationalBreakout(),
  head: () => ({
    meta: [
      { title: "ASTRA NATIONAL BREAKOUT — interne" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "googlebot", content: "noindex, nofollow" },
    ],
  }),
  component: GrowthAdmin,
});

function pct(value: number | null) {
  return value == null ? "UNKNOWN" : `${(value * 100).toFixed(1).replace(".", ",")} %`;
}

function GrowthAdmin() {
  const data = Route.useLoaderData();
  const m = data.metrics;
  const cards = [
    ["Activation", pct(m.activationRate)],
    ["Rétention", pct(m.retentionRate)],
    ["Viralité", pct(m.viralityRate)],
    ["Monétisation", pct(m.monetizationRate)],
    ["Croissance trafic", pct(m.trafficGrowth)],
    ["Croissance affiliation", pct(m.affiliateGrowth)],
  ];

  return (
    <div className="space-y-7">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-link">ASTRA NATIONAL BREAKOUT Ω</p>
        <h1 className="font-display text-3xl tracking-tight">Cockpit de croissance BetGPT</h1>
        <p className="text-sm text-mist">
          Score <strong className="text-paper">{data.score == null ? "UNVERIFIED" : `${data.score}/100`}</strong> · mode <strong className="text-paper">{data.status}</strong> · fenêtre {data.windowHours} h.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(([label, value]) => (
          <div key={label} className="surface-card p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-mist">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-paper">{value}</p>
          </div>
        ))}
      </section>

      <section className="surface-card p-5">
        <h2 className="text-lg font-semibold">Volumes 24 h</h2>
        <p className="mt-2 text-sm text-mist">
          visites {m.sessions} · activations {m.activations} · retours {m.returns} · partages {m.shares} · clics bookmaker {m.affiliateClicks} · Discover prêts {m.discoverReady}/{m.discoverCandidates}
        </p>
      </section>

      <section className="surface-card p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-link">ASTRA SEARCH TRUTH Ω</p>
        <h2 className="mt-1 text-lg font-semibold">Acquisition organique mesurée</h2>
        <p className="mt-2 text-sm text-mist">
          arrivées moteurs {data.searchTruth.measured.organicLandings} · période précédente {data.searchTruth.measured.previousOrganicLandings} · croissance {pct(data.searchTruth.measured.organicGrowth)}
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-paper">Moteurs référents</h3>
            <ul className="mt-2 space-y-1 text-sm text-mist">
              {data.searchTruth.measured.bySource.map((row) => (
                <li key={row.source} className="flex justify-between gap-3">
                  <span>{row.source}</span><span className="tabular text-paper">{row.n}</span>
                </li>
              ))}
              {!data.searchTruth.measured.bySource.length ? <li>Aucune arrivée organique mesurée sur cette fenêtre.</li> : null}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-paper">Landing pages organiques</h3>
            <ul className="mt-2 space-y-1 text-sm text-mist">
              {data.searchTruth.measured.topLandingPages.slice(0, 10).map((row) => (
                <li key={row.route} className="flex justify-between gap-3">
                  <code>{row.route}</code><span className="tabular text-paper">{row.n}</span>
                </li>
              ))}
              {!data.searchTruth.measured.topLandingPages.length ? <li>Aucune landing organique mesurée sur cette fenêtre.</li> : null}
            </ul>
          </div>
        </div>
        <p className="mt-4 text-xs text-muted">
          Requêtes Google, impressions SERP, CTR SERP et position moyenne : UNAVAILABLE tant que Search Console n’est pas connecté. Aucun chiffre n’est estimé.
        </p>
      </section>

      <section className="surface-card p-5">
        <h2 className="text-lg font-semibold">3 actions prioritaires</h2>
        {data.actions.length ? (
          <ol className="mt-3 space-y-3">
            {data.actions.map((action, index) => (
              <li key={action.id} className="rounded-md border border-line p-3">
                <p className="font-semibold text-paper">{index + 1}. {action.title}</p>
                <p className="mt-1 text-sm text-mist">{action.loop} · priorité {action.priority}/100 · {action.reason}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-sm text-mist">Aucun goulot majeur détecté : accélérer les boucles déjà vertes.</p>
        )}
      </section>

      <section className="surface-card p-5">
        <h2 className="text-lg font-semibold">Routes qui concentrent l’activité</h2>
        <ul className="mt-3 space-y-2 text-sm text-mist">
          {data.topRoutes.map((row) => (
            <li key={row.route} className="flex items-center justify-between gap-3 border-b border-line pb-2 last:border-0">
              <code>{row.route}</code>
              <span className="tabular text-paper">{row.n}</span>
            </li>
          ))}
          {!data.topRoutes.length ? <li>Pas encore assez de données serveur.</li> : null}
        </ul>
      </section>
    </div>
  );
}
