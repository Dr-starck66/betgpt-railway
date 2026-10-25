import { useEffect, useState } from "react";
import { Shirt } from "lucide-react";
import { getOfficialLineups } from "@/lib/desk.functions";
import { buildSchematicPitchLayout, buildVerifiedPitchLayout } from "@/engine/lineup-pitch";
import type { OfficialLineups, OfficialTeamLineup, OfficialLineupPlayer } from "@/engine/official-lineups";
import { Crest } from "./crest";

type Props = {
  matchId: string;
  homeName: string;
  awayName: string;
  homeFormation?: string;
  awayFormation?: string;
};

function Bench({ lineup }: { lineup?: OfficialTeamLineup }) {
  if (!lineup?.bench.length) return null;
  return (
    <details className="mt-4 border-t border-line pt-3">
      <summary className="cursor-pointer text-sm font-semibold text-paper">
        Remplaçants ({lineup.bench.length})
      </summary>
      <ul className="mt-3 grid gap-2 text-sm text-mist">
        {lineup.bench.map((player) => (
          <li key={player.id ?? player.name} className="flex items-center gap-3">
            <span className="w-6 shrink-0 text-right text-muted">{player.number ?? "—"}</span>
            <span>{player.name}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function PitchToken({ player, alternate }: { player?: OfficialLineupPlayer; alternate: boolean }) {
  const real = Boolean(player);
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1" title={player?.name ?? "Position théorique — aucun joueur confirmé"}>
      <span
        className={
          "relative grid h-8 w-8 shrink-0 place-items-center rounded-xl border shadow-lg sm:h-10 sm:w-10 " +
          (real
            ? alternate
              ? "border-amber-100 bg-amber-100 text-slate-900"
              : "border-white bg-white text-emerald-950"
            : "border-white/60 bg-white/20 text-white")
        }
      >
        {real ? (
          <span className="text-xs font-extrabold tabular-nums sm:text-sm">{player?.number ?? "•"}</span>
        ) : (
          <Shirt size={20} strokeWidth={1.8} aria-hidden="true" />
        )}
      </span>
      {player ? (
        <span className="max-w-full break-words text-center text-[10px] font-semibold leading-tight text-white [text-shadow:0_1px_3px_#052e16] sm:text-xs">
          {player.name}
        </span>
      ) : null}
    </div>
  );
}

function MatchPitch({
  name,
  formation,
  lineup,
  status,
  alternate = false,
}: {
  name: string;
  formation?: string;
  lineup?: OfficialTeamLineup;
  status: OfficialLineups["status"] | "LOADING";
  alternate?: boolean;
}) {
  const verified = status === "CONFIRMED" && lineup ? buildVerifiedPitchLayout(lineup) : null;
  const schematic = buildSchematicPitchLayout(formation ?? lineup?.formation);
  const rows: Array<Array<OfficialLineupPlayer | null>> = verified
    ? verified.lines
    : schematic
      ? schematic.lines.map((count) => Array.from({ length: count }, () => null))
      : [];
  const mode = verified ? "OFFICIAL" : schematic ? "SCHEMATIC" : "EMPTY";
  const title = verified ? "XI confirmé" : schematic ? "Schéma indicatif" : "Formation indisponible";

  return (
    <section
      className="min-w-0 overflow-hidden rounded-[1.4rem] border border-line bg-white shadow-sm"
      data-pitch-mode={mode}
    >
      <div className="flex min-h-20 items-center gap-3 border-b border-line bg-slate-50/90 p-4 sm:px-5">
        <Crest name={name} short={name.slice(0, 3).toUpperCase()} size={46} />
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold leading-tight text-paper sm:text-lg">{name}</h3>
          <p className="mt-1 text-xs font-medium text-muted">{title}</p>
        </div>
        <span className="shrink-0 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-sm font-black tabular-nums text-emerald-950">
          {verified?.formation ?? schematic?.formation ?? "—"}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div
          role="group"
          aria-label={
            verified
              ? "Terrain tactique de " + name + " : titulaires confirmés, disposition indicative."
              : schematic
                ? "Terrain tactique de " + name + " : placement théorique anonyme, aucun titulaire confirmé."
                : "Terrain de " + name + " : données de placement indisponibles."
          }
          className={
            "relative isolate flex min-h-[300px] flex-col justify-between overflow-hidden rounded-xl border-[3px] border-emerald-950 px-3 py-5 shadow-inner sm:min-h-[400px] sm:px-5 sm:py-8 " +
            (alternate
              ? "bg-[repeating-linear-gradient(180deg,#116448_0%,#116448_20%,#167554_20%,#167554_40%)]"
              : "bg-[repeating-linear-gradient(180deg,#0b6747_0%,#0b6747_20%,#187e57_20%,#187e57_40%)]")
          }
        >
          <div className="pointer-events-none absolute inset-3 rounded border-2 border-white/45" aria-hidden="true">
            <div className="absolute inset-x-0 top-1/2 border-t-2 border-white/45" />
            <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/45" />
            <div className="absolute left-1/2 top-0 h-10 w-[43%] -translate-x-1/2 border-x-2 border-b-2 border-white/45" />
            <div className="absolute bottom-0 left-1/2 h-10 w-[43%] -translate-x-1/2 border-x-2 border-t-2 border-white/45" />
          </div>
          {rows.length ? (
            <div className="relative z-10 flex min-h-[254px] flex-1 flex-col justify-between gap-2 sm:min-h-[340px]">
              {[...rows].reverse().map((line, index) => (
                <div key={index} className="flex min-w-0 items-start justify-around gap-1">
                  {line.map((player, n) => (
                    <PitchToken key={(player?.id ?? player?.name ?? "poste") + "-" + n} player={player ?? undefined} alternate={alternate} />
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="relative z-10 m-auto max-w-[14rem] rounded-xl border border-white/30 bg-emerald-950/70 p-4 text-center text-sm font-semibold text-white">
              Aucune formation fiable. Terrain affiché sans joueurs fictifs.
            </div>
          )}
        </div>

        <div className="mt-3 rounded-lg border border-line bg-slate-50 px-3 py-2 text-xs leading-relaxed text-mist">
          {verified
            ? "11 titulaires fournis et vérifiés. Le placement exact sur les côtés reste indicatif."
            : schematic
              ? "Plan de jeu illustratif (" + schematic.formation + "), pas une composition officielle. Les maillots anonymes n’identifient aucun joueur."
              : "Feuille officielle absente et schéma non vérifiable. Aucun nom ni poste inventé."}
        </div>
        {!verified && lineup?.starters.length ? (
          <details className="mt-3 rounded-lg border border-line p-3">
            <summary className="cursor-pointer text-sm font-semibold text-paper">
              Joueurs fournis par la source ({lineup.starters.length}) · non confirmés comme XI complet
            </summary>
            <ul className="mt-3 grid gap-2 text-sm text-mist">
              {lineup.starters.map((player) => (
                <li key={player.id ?? player.name}>
                  {player.number ? player.number + " · " : ""}{player.name}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        <Bench lineup={lineup} />
      </div>
    </section>
  );
}

/** Shared match route /match/$matchId: past, present and future, without date filtering. */
export function MatchLineups({ matchId, homeName, awayName, homeFormation, awayFormation }: Props) {
  const [data, setData] = useState<OfficialLineups | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    setDone(false);
    setData(null);
    getOfficialLineups({ data: { id: matchId } })
      .then((value) => { if (active) setData(value); })
      .catch(() => { if (active) setData(null); })
      .finally(() => { if (active) setDone(true); });
    return () => { active = false; };
  }, [matchId]);

  const status = data?.status ?? (done ? "UNVERIFIED" : "LOADING");
  const confirmed = data?.status === "CONFIRMED";

  return (
    <section
      id="compositions"
      className="surface-card overflow-hidden border-emerald-900/20 p-4 sm:p-6"
      data-lineups-status={status}
      data-pitch-global="true"
      data-pitch-scope="all-match-routes"
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.17em] text-emerald-700">
            BetGPT · Match Center
          </p>
          <h2 className="mt-1 text-xl font-extrabold tracking-tight text-paper sm:text-2xl">
            Compositions et tactiques sur le terrain
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-mist">
            Deux terrains pour comparer les systèmes de jeu, sur toutes les fiches match.
            {confirmed
              ? " Pour ce match, les 11 titulaires des deux équipes sont vérifiés : feuilles confirmées par le fournisseur, jamais remplacées par une composition probable."
              : " Les 11 titulaires des deux équipes ne sont pas tous vérifiés : les maillots anonymes illustrent uniquement un schéma tactique."}
          </p>
        </div>
        <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-900">
          {confirmed ? "XI officiels vérifiés" : status === "PARTIAL" ? "Données partielles" : done ? "XI non vérifiés" : "Terrain disponible · XI en vérification"}
        </span>
      </div>
      <div className="grid gap-4 lg:grid-cols-2" data-pitch-pair="true">
        <MatchPitch name={homeName} formation={homeFormation ?? data?.home?.formation} lineup={data?.home} status={status} />
        <MatchPitch name={awayName} formation={awayFormation ?? data?.away?.formation} lineup={data?.away} status={status} alternate />
      </div>
      {done && data?.reason ? <p className="mt-3 text-xs text-muted">{data.reason}</p> : null}
      {data?.sourceUrl ? (
        <p className="mt-3 text-xs text-muted">
          Source des effectifs :{" "}
          <a href={data.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-link underline underline-offset-2">
            {data.sourceLabel}
          </a>
          {" · "}contrôlée le {new Date(data.observedAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}.
        </p>
      ) : null}
    </section>
  );
}
