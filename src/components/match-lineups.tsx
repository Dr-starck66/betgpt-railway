import { useEffect, useState } from "react";
import { getOfficialLineups } from "@/lib/desk.functions";
import type { OfficialLineups, OfficialTeamLineup } from "@/engine/official-lineups";

type Props = {
  matchId: string;
  homeName: string;
  awayName: string;
};

function Team({ lineup }: { lineup: OfficialTeamLineup }) {
  return (
    <div className="rounded-xl border border-line bg-raised/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-paper">{lineup.teamName}</h3>
        {lineup.formation ? <span className="text-xs text-muted">{lineup.formation}</span> : null}
      </div>
      <ol className="mt-3 grid gap-1.5 text-sm">
        {lineup.starters.map((player) => (
          <li key={player.id ?? player.name} className="flex gap-2 text-mist">
            <span className="w-6 shrink-0 text-right tabular text-muted">{player.number ?? "—"}</span>
            <span className="text-paper">{player.name}</span>
            {player.position ? <span className="ml-auto text-xs text-muted">{player.position}</span> : null}
          </li>
        ))}
      </ol>
      {lineup.bench.length ? (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-muted">Banc ({lineup.bench.length})</summary>
          <ul className="mt-2 grid gap-1">
            {lineup.bench.map((player) => (
              <li key={player.id ?? player.name} className="flex gap-2 text-mist">
                <span className="w-6 shrink-0 text-right tabular text-muted">{player.number ?? "—"}</span>
                <span>{player.name}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

export function MatchLineups({ matchId, homeName, awayName }: Props) {
  const [data, setData] = useState<OfficialLineups | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    setDone(false);
    getOfficialLineups({ data: { id: matchId } })
      .then((value) => {
        if (active) setData(value);
      })
      .catch(() => {
        if (active) setData(null);
      })
      .finally(() => {
        if (active) setDone(true);
      });
    return () => {
      active = false;
    };
  }, [matchId]);

  return (
    <section className="surface-card p-5" data-lineups-status={data?.status ?? (done ? "UNVERIFIED" : "LOADING")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Compositions</h2>
          <p className="mt-1 text-xs text-muted">
            {data?.status === "CONFIRMED"
              ? "Feuilles confirmées par le fournisseur, jamais remplacées par une composition probable."
              : done
                ? "BetGPT n'affiche pas une composition comme officielle tant que les 11 titulaires des deux équipes ne sont pas vérifiés."
                : "Vérification indépendante en cours — la page reste utilisable pendant la récupération."}
          </p>
        </div>
        {data?.status === "CONFIRMED" ? (
          <span className="rounded-full border border-sage/30 px-2.5 py-1 text-xs font-semibold text-sage">Confirmées</span>
        ) : data?.status === "PARTIAL" ? (
          <span className="rounded-full border border-clay/30 px-2.5 py-1 text-xs font-semibold text-clay">Partielles</span>
        ) : null}
      </div>

      {data?.home && data?.away ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Team lineup={data.home} />
          <Team lineup={data.away} />
        </div>
      ) : done ? (
        <div className="mt-4 rounded-xl border border-line bg-raised/40 p-4 text-sm text-mist">
          Composition confirmée indisponible pour {homeName} – {awayName}.
          {data?.reason ? <span className="ml-1 text-muted">{data.reason}</span> : null}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-line bg-raised/40 p-4 text-sm text-muted">
          Recherche de la feuille officielle…
        </div>
      )}

      {data?.sourceUrl ? (
        <p className="mt-3 text-xs text-muted">
          Source :{" "}
          <a href={data.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-link underline underline-offset-2">
            {data.sourceLabel}
          </a>
          {" · "}contrôlée le {new Date(data.observedAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}.
        </p>
      ) : null}
    </section>
  );
}
