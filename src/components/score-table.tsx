import { fmtPct } from "@/lib/utils";

export function ScoreTable({
  rows,
  caption,
  totalN,
}: {
  rows: { score: string; n: number; freq: number }[];
  caption: string;
  totalN?: number;
}) {
  if (!rows.length) {
    return (
      <p className="rounded-lg border border-line bg-surface p-4 text-sm text-mist">
        Échantillon insuffisant. Aucune fréquence affichée.
      </p>
    );
  }
  const displayed = rows.reduce((s, r) => s + r.n, 0);
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full min-w-[20rem] text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-line text-xs uppercase tracking-wider text-muted">
          <tr>
            <th className="px-4 py-3 font-medium">Score exact</th>
            <th className="px-4 py-3 font-medium">Matches</th>
            <th className="px-4 py-3 font-medium">Fréquence</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.score} className="border-b border-line last:border-0">
              <td className="px-4 py-3 font-semibold tabular">{r.score.replace("-", "–")}</td>
              <td className="px-4 py-3 tabular text-mist">{r.n}</td>
              <td className="px-4 py-3 tabular">{fmtPct(r.freq)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {totalN != null ? (
        <p className="border-t border-line px-4 py-3 text-xs text-muted">
          Somme des scores listés : {displayed.toLocaleString("fr-FR")} · matches analysés : {totalN.toLocaleString("fr-FR")}
          {displayed === totalN
            ? ". Les totaux concordent."
            : ". Le tableau n’affiche que les scores les plus fréquents ; la somme de tous les scores exacts égale n."}
        </p>
      ) : null}
    </div>
  );
}
