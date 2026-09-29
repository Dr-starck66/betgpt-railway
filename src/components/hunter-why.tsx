import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { fmtPct } from "@/lib/utils";
import { track } from "@/lib/analytics";

export type WhyRow = {
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

export function HunterWhy({ row, scenarioLabel }: { row: WhyRow; scenarioLabel: string }) {
  const [open, setOpen] = useState(false);
  const q = `Pourquoi ${row.home.name} – ${row.away.name} est classé ${row.score}/100 au Score Hunter ${scenarioLabel} ? Cite n=${row.nLeague}.`;
  return (
    <div className="border-t border-line pt-3">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => {
            if (!v) track("why_this_score", row.slug);
            return !v;
          });
        }}
        className="min-h-11 text-sm font-semibold text-sage"
      >
        {open ? "Masquer le détail" : "Pourquoi ce score ?"}
      </button>
      {open ? (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-paper">
            Score Hunter : <span className="font-semibold tabular">{row.score}/100</span>
            {" · "}estimation modèle {fmtPct(row.modelP)}
            {row.impliedP != null ? ` · implicite brute ${fmtPct(row.impliedP)}` : ""}
            {row.impliedNoVigP != null ? ` · no-vig ${fmtPct(row.impliedNoVigP)}` : ""}
          </p>
          <ul className="space-y-1.5 text-sm text-mist">
            {row.why.map((w) => (
              <li key={w.label}>
                {w.label} : <span className="text-paper">{w.value}</span>
                {w.n > 0 ? <span className="text-muted"> (n={w.n})</span> : null}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">
            Index Hunter ≠ probabilité. Archive ESPN = DERIVED_FROM_REAL_DATA. Profils équipe (xG, PPDA,
            possession) = MODEL_ESTIMATE.
          </p>
          <p className="text-sm text-paper">{row.commentary}</p>
          <Link
            to="/chat"
            search={{ q }}
            className="inline-flex min-h-11 items-center rounded-md bg-sage px-4 text-sm font-semibold text-ink"
          >
            Demander à BetGPT
          </Link>
        </div>
      ) : null}
    </div>
  );
}
