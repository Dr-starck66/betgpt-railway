import type { MatchIncident, MatchInput } from "@/engine/types";
import { liveRecap, scorersLine } from "@/lib/seo";

export function LiveRecap({ match }: { match: MatchInput }) {
  if (match.status !== "live" && match.status !== "finished") return null;
  const incidents = match.incidents ?? [];
  const goals = incidents.filter((i) => i.kind === "goal" || i.kind === "penalty" || i.kind === "own_goal");
  const cards = incidents.filter((i) => i.kind === "yellow" || i.kind === "red");
  return (
    <section className="rounded-xl border border-sage/40 bg-surface p-5">
      <h2 className="text-lg font-semibold tracking-tight">
        {match.status === "live"
          ? `Résumé en direct ${match.home.name} ${match.away.name}`
          : `Buteurs ${match.home.name} ${match.away.name}`}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-paper">{liveRecap(match)}</p>
      {goals.length ? (
        <>
          <h3 className="mt-4 text-sm font-semibold">Buteurs</h3>
          <p className="mt-1 text-sm text-mist">{scorersLine(match)}</p>
          <ul className="mt-2 space-y-1 text-sm">
            {goals.map((g, i) => (
              <li key={`${g.minute}-${g.player}-${i}`} className="text-paper">
                <span className="tabular text-muted">{g.minute || "—"}</span>
                {" · "}
                {g.label} {g.player}
                {g.assist ? ` (passe ${g.assist})` : ""}
                {" · "}
                {g.side === "home" ? match.home.short : match.away.short}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-2 text-sm text-mist">
          {match.status === "live" ? "Pas encore de but. Le fil se met à jour en direct." : "Pas de buteur listé."}
        </p>
      )}
      {cards.length ? (
        <>
          <h3 className="mt-4 text-sm font-semibold">Cartons</h3>
          <ul className="mt-2 space-y-1 text-sm text-mist">
            {cards.map((c, i) => (
              <li key={`${c.minute}-${c.player}-${i}`}>
                <span className="tabular">{c.minute || "—"}</span> · {c.label} {c.player}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {incidents.length > goals.length + cards.length ? (
        <Timeline incidents={incidents} />
      ) : null}
    </section>
  );
}

function Timeline({ incidents }: { incidents: MatchIncident[] }) {
  return (
    <>
      <h3 className="mt-4 text-sm font-semibold">Actions</h3>
      <ol className="mt-2 space-y-1 text-sm text-mist">
        {incidents.map((i, n) => (
          <li key={`${i.minute}-${i.kind}-${n}`}>
            <span className="tabular text-paper">{i.minute || "—"}</span> · {i.label} {i.player}
          </li>
        ))}
      </ol>
    </>
  );
}
