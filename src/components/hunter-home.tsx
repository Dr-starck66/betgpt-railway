import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Crosshair } from "lucide-react";
import { HunterBoard, type BoardRow } from "@/components/hunter-board";
import { FollowStar } from "@/components/follow-star";
import { getHunterHome } from "@/lib/hunter.functions";

export function HomeHunter() {
  const load = useServerFn(getHunterHome);
  const [data, setData] = useState<Awaited<ReturnType<typeof getHunterHome>> | null>(null);
  useEffect(() => {
    let alive = true;
    void load()
      .then((row) => {
        if (alive) setData(row);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
    // fetch once per mount — a changing server-fn identity was remounting the boards
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!data) {
    return (
      <section className="min-h-[24rem] rounded-lg border border-line bg-surface p-4" aria-busy="true">
        <p className="text-sm text-mist">Score Hunter : calcul des classements sur l’archive réelle…</p>
      </section>
    );
  }
  if (data.degraded && data.boards.every((b) => b.n === 0)) {
    return (
      <section className="rounded-lg border border-line bg-surface p-4">
        <p className="text-sm text-paper">Score Hunter indisponible pour l’instant. Pas de chiffres inventés.</p>
      </section>
    );
  }
  return <HunterHomeStrip boards={data.boards} historyN={data.historyN} />;
}

export function HunterHomeStrip({
  boards,
  historyN,
}: {
  boards: { slug: string; label: string; short: string; rows: BoardRow[]; n: number }[];
  historyN: number;
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-sage">Score Hunter</p>
          <h2 className="text-lg font-semibold tracking-tight">Matches classés par scénario</h2>
          <p className="mt-1 text-sm text-mist">
            Score 0–100 calculé sur le modèle Poisson / Dixon-Coles et {historyN.toLocaleString("fr-FR")} matches
            d’archive ESPN. Pas une certitude.
          </p>
        </div>
        <Link
          to="/score-hunter"
          className="inline-flex min-h-11 items-center gap-2 rounded-md bg-sage px-4 text-sm font-semibold text-ink"
        >
          <Crosshair className="h-4 w-4" />
          Tous les hunters
        </Link>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {boards.map((b) => (
          <article key={b.slug} className="min-w-0 rounded-lg border border-line bg-surface p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="font-semibold tracking-tight">{b.label}</h3>
              <FollowStar kind="hunter" id={b.slug} label={b.label} />
            </div>
            <HunterBoard slug={b.slug} label={b.label} short={b.short} rows={b.rows} compact />
          </article>
        ))}
      </div>
    </section>
  );
}
