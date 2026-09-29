import { Link, createFileRoute } from "@tanstack/react-router";
import { getPublicDesk } from "@/lib/desk.functions";
import { SITE_URL } from "@/lib/programmatic";

export const Route = createFileRoute("/rapports/precision")({
  loader: () => getPublicDesk(),
  head: () => ({
    meta: [
      { title: "Rapport de précision des pronostics | BetGPT" },
      {
        name: "description",
        content:
          "Chiffres du bilan BetGPT calculés sur les pronostics enregistrés avant le coup d’envoi. ROI absent si les cotes manquent.",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:url", content: `${SITE_URL}/rapports/precision` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/rapports/precision` }],
  }),
  component: Page,
});

function cell(v: number | null | undefined, digits = 1): string {
  if (v == null || Number.isNaN(v)) return "non calculé";
  return v.toFixed(digits).replace(".", ",");
}

function Page() {
  const desk = Route.useLoaderData();
  const e = desk.evidence;
  return (
    <article className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold">Rapport de précision</h1>
      <p className="text-sm text-mist">
        Ces chiffres reprennent le bilan des lignes éligibles, enregistrées avant le coup d’envoi. Ils ne sont pas un taux marketing.
        Export brut : <a href="/evidence.json" className="underline">evidence.json</a>
        {" · "}
        <a href="/evidence.csv" className="underline">CSV</a>.
      </p>
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <Stat label="Avant coup d’envoi" value={String(e.beforeKickoff)} />
        <Stat label="Réglés" value={String(e.settled)} />
        <Stat label="Gagnés / perdus" value={`${e.wins} / ${e.losses}`} />
        <Stat label="Taux" value={e.winRate == null ? "non calculé" : `${(e.winRate * 100).toFixed(1).replace(".", ",")} %`} />
        <Stat label="ROI" value={e.roi == null ? "non calculé" : `${(e.roi * 100).toFixed(1).replace(".", ",")} %`} />
        <Stat label="Brier" value={cell(e.brier, 3)} />
        <Stat label="Échantillon" value={e.sampleLabel} />
      </dl>
      {e.unavailable.length ? (
        <ul className="list-disc pl-5 text-sm text-muted">
          {e.unavailable.map((u) => (
            <li key={u}>{u}</li>
          ))}
        </ul>
      ) : null}
      <p className="text-sm">
        <Link to="/ledger" className="text-sage">
          Détail du bilan
        </Link>
        {" · "}
        <Link to="/methodology" className="text-sage">
          Méthode
        </Link>
      </p>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}
