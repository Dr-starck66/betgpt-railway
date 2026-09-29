import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { HunterWhy } from "@/components/hunter-why";
import { getMatchHunter } from "@/lib/hunter.functions";
import { fmtPct } from "@/lib/utils";

type Score = {
  slug: string;
  label: string;
  short: string;
  row: {
    slug: string;
    score: number;
    modelP: number;
    nLeague: number;
    nHome: number;
    nAway: number;
    sampleNote: string;
    commentary: string;
    impliedP: number | null;
    impliedNoVigP?: number | null;
    why: { label: string; value: string; n: number; layer: string }[];
    home: { name: string };
    away: { name: string };
  };
};

export function MatchHunter({
  matchId,
  scores,
  historyN,
}: {
  matchId?: string;
  scores?: Score[];
  historyN?: number;
}) {
  const load = useServerFn(getMatchHunter);
  const [pack, setPack] = useState<{ scores: Score[]; historyN: number } | null>(
    scores?.length ? { scores, historyN: historyN ?? 0 } : null,
  );
  useEffect(() => {
    if (pack || !matchId) return;
    let alive = true;
    void load({ data: { id: matchId } })
      .then((row) => {
        if (!alive || !row?.scores?.length) return;
        setPack({ scores: row.scores, historyN: row.historyN });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
    // once per match — a changing server-fn identity was remounting the page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);
  if (!pack?.scores.length) return null;
  return (
    <section className="rounded-lg border border-line bg-surface p-5">
      <h2 className="text-lg font-semibold tracking-tight">Score Hunter pour ce match</h2>
      <p className="mt-1 text-sm text-mist">
        Classement 0–100 parmi les matches du desk. Archive n={pack.historyN.toLocaleString("fr-FR")}. Estimation, pas
        une certitude.
      </p>
      <ul className="mt-4 divide-y divide-line">
        {pack.scores.slice(0, 5).map((s) => (
          <li key={s.slug} className="py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link
                to="/score-hunter/$scenario"
                params={{ scenario: s.slug }}
                className="font-semibold text-paper hover:text-sage"
              >
                {s.label}
              </Link>
              <span className="tabular text-sm font-semibold">
                {s.row.score}/100 · {fmtPct(s.row.modelP)}
              </span>
            </div>
            <HunterWhy row={s.row} scenarioLabel={s.short} />
          </li>
        ))}
      </ul>
    </section>
  );
}