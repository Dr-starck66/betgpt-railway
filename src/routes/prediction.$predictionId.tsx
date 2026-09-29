import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { getEvidence } from "@/lib/desk.functions";
import { SITE_URL } from "@/lib/seo";
import { fmtOdds, fmtPct } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Crest } from "@/components/crest";

export const Route = createFileRoute("/prediction/$predictionId")({
  loader: async ({ params }) => {
    const data = await getEvidence({ data: { id: params.predictionId } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData, params }) => {
    const row = loaderData?.row;
    const title = row
      ? `Vérification · ${row.home} – ${row.away} | BetGPT`
      : "Vérification pronostic | BetGPT";
    return {
      meta: [
        { title },
        {
          name: "description",
          content: row
            ? `Pronostic horodaté ${row.label} · ${fmtOdds(row.odds)}. Conservé même s'il perd. Pas une certitude. 18+.`
            : "Registre public des pronostics BetGPT.",
        },
        { name: "robots", content: "index, follow" },
      ],
      links: [{ rel: "canonical", href: `${SITE_URL}/prediction/${params.predictionId}` }],
    };
  },
  component: PredictionPage,
  notFoundComponent: () => <p className="text-muted">Pronostic introuvable.</p>,
});

function utc(iso: string) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  return `${format(new Date(t), "d MMM yyyy · HH:mm", { locale: fr })} UTC`;
}

function PredictionPage() {
  const { row, status, statusLabel, lifecycleLabel, beforeKickoff, minutes, events, integrity } = Route.useLoaderData();
  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-sage">Registre public</p>
      <header className="rounded-xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={status === "verified" ? "sage" : status === "partial" ? "clay" : "mist"}>
            {statusLabel}
          </Badge>
          <Badge tone={lifecycleLabel === "Publié" ? "mist" : "sage"}>{lifecycleLabel}</Badge>
          {row.result === "win" ? <Badge tone="sage">Gagnant</Badge> : null}
          {row.result === "lose" ? <Badge tone="rust">Perdant</Badge> : null}
          {row.result === "void" ? <Badge tone="mist">Annulé</Badge> : null}
        </div>
        <h1 className="mt-3 flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
          <Crest name={row.home} short={row.home.slice(0, 3)} size={28} />
          {row.home} – {row.away}
          <Crest name={row.away} short={row.away.slice(0, 3)} size={28} />
        </h1>
        <p className="mt-2 text-sm text-mist">
          BetGPT ne supprime pas les pronostics perdants. Pas une certitude. 18+.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2">
        <Fact label="Pronostic" value={row.label} />
        <Fact label="Marché" value={row.market} />
        <Fact label="Probabilité modèle" value={fmtPct(row.modelProb)} />
        <Fact label="Espérance (EV)" value={Number.isFinite(row.ev) ? fmtPct(row.ev) : "Non collecté"} />
        <Fact label="Cote figée" value={`${fmtOdds(row.odds)} · ${row.book}`} />
        <Fact label="Instantané cotes" value={utc(row.recordedAt)} />
        <Fact label="Publié" value={utc(row.recordedAt)} />
        <Fact label="Coup d'envoi" value={utc(row.kickoff)} />
        <Fact
          label="Publié avant le coup d'envoi"
          value={beforeKickoff ? "OUI" : "NON"}
        />
        <Fact
          label="Écart"
          value={
            minutes == null
              ? "Indisponible"
              : minutes >= 0
                ? `${minutes} min avant le coup d'envoi`
                : `${Math.abs(minutes)} min après le coup d'envoi`
          }
        />
        <Fact label="Moteur" value={beforeKickoff ? (row.engineVersion ?? "Non collecté (fiche héritée)") : "Non collecté (après coup d'envoi)"} />
        <Fact
          label="Hash SHA-256"
          value={beforeKickoff && row.predictionHash ? row.predictionHash : "Non collecté (fiche héritée)"}
        />
        <Fact
          label="Intégrité du hash"
          value={integrity === "ok" ? "OK" : integrity === "mismatch" ? "Écart détecté" : "Indisponible"}
        />
        <Fact
          label="Score final"
          value={
            row.goalsHome != null && row.goalsAway != null
              ? `${row.goalsHome}–${row.goalsAway}`
              : "En attente"
          }
        />
        <Fact
          label="Règlement"
          value={row.result === "win" ? "Gagné" : row.result === "lose" ? "Perdu" : row.result === "void" ? "Annulé" : "En attente"}
        />
      </section>

      {row.snapshots && row.snapshots.length ? (
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="font-display text-lg">Révisions avant coup d'envoi</h2>
          <ol className="mt-3 space-y-2 text-sm text-mist">
            {row.snapshots.map((s, i) => (
              <li key={s.at}>
                V{i + 1} · {utc(s.at)} · {s.label} @ {fmtOdds(s.odds)}
              </li>
            ))}
            <li>
              V{(row.revision ?? row.snapshots.length + 1)} · actuel · {row.label} @ {fmtOdds(row.odds)}
            </li>
          </ol>
        </section>
      ) : null}

      {events.length ? (
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="font-display text-lg">Journal</h2>
          <ul className="mt-3 space-y-1.5 text-sm text-mist">
            {events.map((e) => (
              <li key={e.id}>
                {utc(e.at)} · {e.type.replaceAll("_", " ")}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="text-sm">
        <Link to="/ledger" className="text-sage hover:underline">
          Retour au bilan
        </Link>
        {" · "}
        <Link
          to="/match/$matchId"
          params={{ matchId: row.matchId }}
          className="text-sage hover:underline"
        >
          Fiche match
        </Link>
      </p>
    </article>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 break-all text-sm text-paper">{value}</p>
    </div>
  );
}
