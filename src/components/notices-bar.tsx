import { useEffect, useState } from "react";
import { dismissNotice, kickoffNotices, type LocalNotice } from "@/lib/notifications";
import { loadFollows } from "@/lib/follows";

export function NoticesBar({
  matches,
}: {
  matches: { id: string; slug?: string; kickoff: string; home: { name: string }; away: { name: string } }[];
}) {
  const [rows, setRows] = useState<LocalNotice[]>([]);
  useEffect(() => {
    const teams = loadFollows().teams;
    setRows(kickoffNotices(matches, teams));
  }, [matches]);
  if (!rows.length) return null;
  return (
    <ul className="space-y-2">
      {rows.map((n) => (
        <li key={n.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sage/40 bg-surface px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-paper">{n.title}</p>
            <p className="text-xs text-mist">{n.body}</p>
          </div>
          <div className="flex gap-2">
            <a href={n.href} className="inline-flex min-h-11 items-center rounded-md bg-sage px-3 text-sm font-semibold text-ink">
              Voir
            </a>
            <button
              type="button"
              className="min-h-11 rounded-md border border-line px-3 text-sm text-mist"
              onClick={() => {
                dismissNotice(n.id);
                setRows((xs) => xs.filter((x) => x.id !== n.id));
              }}
            >
              Masquer
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
