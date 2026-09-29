import { useEffect, useState } from "react";
import { geoHealth, type HealthRow } from "@/lib/geo/health";
import {
  VISIBILITY_ENGINES,
  visibilitySeed,
  type VisibilityObservation,
} from "@/lib/geo/visibility";

const STORAGE = "betgpt-ai-visibility";

function statusClass(status: HealthRow["status"]): string {
  if (status === "PASS") return "text-sage";
  if (status === "FAIL") return "text-red-300";
  return "text-mist";
}

export function GeoHealthPanel() {
  const rows = geoHealth();
  const [rowsObs, setRowsObs] = useState<VisibilityObservation[]>(() => visibilitySeed());
  const [draft, setDraft] = useState<VisibilityObservation>(visibilitySeed()[0]!);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (!raw) return;
      const parsed = JSON.parse(raw) as VisibilityObservation[];
      if (Array.isArray(parsed) && parsed.length) setRowsObs(parsed);
    } catch {
      /* ignore broken local notes */
    }
  }, []);

  function save(next: VisibilityObservation) {
    if (!next.engine || !next.checkedAt) return;
    const without = rowsObs.filter((row) => !(row.query === next.query && row.engine === next.engine && row.checkedAt === next.checkedAt));
    const all = [...without, next];
    setRowsObs(all);
    localStorage.setItem(STORAGE, JSON.stringify(all));
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Santé SEO / GEO</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-mist">
          Diagnostic interne. PASS veut dire qu’un contrôle du code a réussi. Ce n’est pas une preuve que Google ou un assistant cite BetGPT.
        </p>
      </header>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wider text-muted">
            <th className="py-2 pr-3">Contrôle</th>
            <th className="py-2 pr-3">Statut</th>
            <th className="py-2">Détail</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-line align-top">
              <td className="py-2 pr-3 font-semibold text-paper">{row.id}</td>
              <td className={`py-2 pr-3 font-semibold ${statusClass(row.status)}`}>{row.status}</td>
              <td className="py-2 text-mist">{row.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Visibilité IA — saisie manuelle</h2>
        <p className="text-sm text-mist">
          Aucune API n’est interrogée. Tant qu’une ligne n’a pas été enregistrée ici, le statut est UNVERIFIED. Ne pas cocher une mention sans l’avoir vue.
        </p>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            save(draft);
          }}
        >
          <label className="text-sm">
            Requête
            <select
              className="mt-1 min-h-11 w-full rounded-md border border-line bg-pitch px-2"
              value={draft.query}
              onChange={(event) => setDraft({ ...draft, query: event.target.value })}
            >
              {visibilitySeed().map((row) => (
                <option key={row.query}>{row.query}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Moteur
            <select
              className="mt-1 min-h-11 w-full rounded-md border border-line bg-pitch px-2"
              value={draft.engine}
              onChange={(event) => setDraft({ ...draft, engine: event.target.value })}
            >
              <option value="">Choisir</option>
              {VISIBILITY_ENGINES.map((engine) => (
                <option key={engine}>{engine}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Date observée
            <input
              type="date"
              className="mt-1 min-h-11 w-full rounded-md border border-line bg-pitch px-2"
              value={draft.checkedAt ?? ""}
              onChange={(event) => setDraft({ ...draft, checkedAt: event.target.value || null })}
            />
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.mentioned === true}
              onChange={(event) => setDraft({ ...draft, mentioned: event.target.checked })}
            />
            BetGPT était mentionné dans cette observation
          </label>
          <label className="text-sm sm:col-span-2">
            URL BetGPT vue
            <input
              className="mt-1 min-h-11 w-full rounded-md border border-line bg-pitch px-2"
              value={draft.url}
              onChange={(event) => setDraft({ ...draft, url: event.target.value })}
              placeholder="Laisser vide si non vue"
            />
          </label>
          <label className="text-sm sm:col-span-2">
            Notes
            <textarea
              className="mt-1 min-h-24 w-full rounded-md border border-line bg-pitch px-2 py-2"
              value={draft.notes}
              onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
            />
          </label>
          <button type="submit" className="min-h-11 rounded-md bg-sage px-3 text-sm font-semibold text-ink sm:col-span-2">
            Enregistrer l’observation
          </button>
        </form>
        <ul className="space-y-2 text-sm">
          {rowsObs.map((row) => (
            <li key={`${row.query}-${row.engine}-${row.checkedAt}`} className="rounded-md border border-line px-3 py-2">
              <span className="font-semibold text-paper">{row.query}</span>
              {" — "}
              {row.checkedAt ? `${row.engine} · ${row.checkedAt} · ${row.mentioned ? "mention vue" : "mention non vue"}` : "UNVERIFIED"}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
