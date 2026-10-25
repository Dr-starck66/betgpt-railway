import { useEffect, useState } from "react";
import { getOfficialLineups } from "@/lib/desk.functions";
import { buildVerifiedPitchLayout } from "@/engine/lineup-pitch";
import type { OfficialLineups, OfficialTeamLineup, OfficialLineupPlayer } from "@/engine/official-lineups";
import { Crest } from "./crest";

type Props = {
  matchId: string;
  homeName: string;
  awayName: string;
  homeFormation?: string;
  awayFormation?: string;
};

function TeamHeader({ name, formation, confirmed }: { name: string; formation?: string; confirmed: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Crest name={name} short={name.slice(0, 3).toUpperCase()} size={38} />
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-bold leading-tight text-paper">{name}</h3>
        <p className="mt-1 text-xs text-muted">
          {formation ? `${confirmed ? "Système confirmé" : "Schéma non confirmé"} · ${formation}` : "Schéma indisponible"}
        </p>
      </div>
    </div>
  );
}

function PitchPlayer({ player }: { player: OfficialLineupPlayer }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1" title={player.name}>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-white/75 bg-white font-bold tabular-nums text-emerald-950 shadow-lg sm:h-9 sm:w-9">
        {player.number || "•"}
      </span>
      <span className="max-w-full break-words text-center text-[10px] font-semibold leading-tight text-white drop-shadow-sm sm:text-xs">
        {player.name}
      </span>
    </div>
  );
}

function Pitch({ lineup }: { lineup: OfficialTeamLineup }) {
  const layout = buildVerifiedPitchLayout(lineup);
  if (!layout) return <RosterList lineup={lineup} />;

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-white/90 p-3 shadow-sm sm:p-4" aria-label={`Composition confirmée ${lineup.teamName}`}>
      <TeamHeader name={lineup.teamName} formation={layout.formation} confirmed />
      <div
        className="relative mt-4 aspect-[4/5] min-h-[360px] overflow-hidden rounded-xl border-4 border-emerald-900 bg-gradient-to-b from-emerald-800 via-emerald-700 to-emerald-900"
        role="img"
        aria-label={`Terrain ${lineup.teamName}, ${layout.formation}. Placement indicatif par ligne.`}
      >
        <div className="pointer-events-none absolute inset-3 rounded-sm border-2 border-white/35" aria-hidden="true">
          <div className="absolute left-1/2 top-0 h-12 w-2/5 -translate-x-1/2 border-x-2 border-b-2 border-white/35" />
          <div className="absolute bottom-0 left-1/2 h-12 w-2/5 -translate-x-1/2 border-x-2 border-t-2 border-white/35" />
          <div className="absolute inset-x-0 top-1/2 border-t-2 border-white/35" />
          <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/35" />
        </div>
        <div className="relative z-10 flex h-full flex-col justify-between gap-2 px-2 py-5 sm:px-3 sm:py-7">
          {[...layout.lines].reverse().map((line, i) => (
            <div key={i} className="flex min-w-0 justify-around gap-1">
              {line.map((player) => <PitchPlayer key={player.id ?? player.name} player={player} />)}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-2 text-xs text-muted">
        Titulaires vérifiés · Placement graphique indicatif : la position gauche/droite n’est pas une donnée de suivi.
      </p>
      <Bench lineup={lineup} />
    </section>
  );
}

function Bench({ lineup }: { lineup: OfficialTeamLineup }) {
  if (!lineup.bench.length) return null;
  return (
    <details className="mt-3 border-t border-line pt-3 text-sm">
      <summary className="cursor-pointer font-medium text-paper">Remplaçants ({lineup.bench.length})</summary>
      <ul className="mt-3 grid gap-2 text-mist">
        {lineup.bench.map((player) => (
          <li key={player.id ?? player.name} className="flex items-center gap-2">
            <span className="w-7 shrink-0 text-right text-muted">{player.number ?? "—"}</span>
            <span>{player.name}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function RosterList({ lineup }: { lineup: OfficialTeamLineup }) {
  return (
    <section className="rounded-2xl border border-line bg-white/90 p-4">
      <TeamHeader name={lineup.teamName} formation={lineup.formation} confirmed={false} />
      <p className="mt-3 text-xs font-medium text-clay">
        Feuille incomplète ou schéma non vérifiable : {lineup.starters.length} titulaires transmis. Aucun terrain officiel simulé.
      </p>
      <ol className="mt-3 grid gap-1.5 text-sm">
        {lineup.starters.map((p) => (
          <li key={p.id ?? p.name} className="flex items-center gap-2 text-paper">
            <span className="w-7 text-right tabular-nums text-muted">{p.number ?? "—"}</span>
            <span>{p.name}</span>
            {p.position ? <span className="ml-auto text-xs text-muted">{p.position}</span> : null}
          </li>
        ))}
      </ol>
      <Bench lineup={lineup} />
    </section>
  );
}

function PendingTeam({ name, formation }: { name: string; formation?: string }) {
  return (
    <section className="rounded-2xl border border-line bg-white/90 p-4">
      <TeamHeader name={name} formation={formation} confirmed={false} />
      <div className="mt-3 flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed border-emerald-800/25 bg-emerald-900/5 p-5 text-center">
        <p className="text-sm font-semibold text-paper">XI officiel en attente</p>
        <p className="mt-1 text-xs text-muted">Aucun joueur ou placement inventé.</p>
      </div>
    </section>
  );
}

export function MatchLineups({ matchId, homeName, awayName, homeFormation, awayFormation }: Props) {
  const [data, setData] = useState<OfficialLineups | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    setData(null);
    setDone(false);
    getOfficialLineups({ data: { id: matchId } })
      .then((value) => { if (active) setData(value); })
      .catch(() => { if (active) setData(null); })
      .finally(() => { if (active) setDone(true); });
    return () => { active = false; };
  }, [matchId]);

  const confirmed = data?.status === "CONFIRMED" && !!data.home && !!data.away;

  return (
    <section id="compositions" className="surface-card overflow-hidden p-5 sm:p-6" data-lineups-status={data?.status ?? (done ? "UNVERIFIED" : "LOADING")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-sage">BetGPT · Analyse tactique</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-paper sm:text-2xl">Compositions et terrain tactique</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-mist">
            {confirmed
              ? "Les 11 titulaires des deux équipes sont vérifiés : feuilles confirmées par le fournisseur, jamais remplacées par une composition probable."
              : done
                ? "Les 11 titulaires des deux équipes ne sont pas tous vérifiés : les informations absentes restent explicitement indisponibles."
                : "Récupération indépendante des feuilles officielles, sans bloquer l’analyse et les pronostics."}
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1.5 text-xs font-bold ${confirmed ? "border-sage/40 bg-sage/10 text-sage" : "border-line bg-white text-muted"}`}>
          {confirmed ? "XI confirmés" : data?.status === "PARTIAL" ? "Feuilles partielles" : done ? "Non vérifié" : "Vérification…"}
        </span>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {confirmed && data?.home && data?.away ? (
          <>
            <Pitch lineup={data.home} />
            <Pitch lineup={data.away} />
          </>
        ) : (
          <>
            {data?.home ? <RosterList lineup={data.home} /> : <PendingTeam name={homeName} formation={homeFormation} />}
            {data?.away ? <RosterList lineup={data.away} /> : <PendingTeam name={awayName} formation={awayFormation} />}
          </>
        )}
      </div>
      {done && data?.reason ? <p className="mt-3 text-xs text-muted">{data.reason}</p> : null}
      {data?.sourceUrl ? (
        <p className="mt-4 text-xs text-muted">
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
