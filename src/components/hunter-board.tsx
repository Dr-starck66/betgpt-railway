import { Link } from "@tanstack/react-router";
import { Crest } from "@/components/crest";
import { FollowStar } from "@/components/follow-star";
import { HunterWhy } from "@/components/hunter-why";
import { ShareHunter } from "@/components/share-hunter";
import { LEAGUE_LABEL } from "@/lib/labels";
import { fmtPct } from "@/lib/utils";
import type { LeagueId } from "@/engine/types";

export type BoardRow = {
  matchId: string;
  slug: string;
  league: LeagueId;
  competition: string;
  kickoff: string;
  status: string;
  home: { id: string; name: string; short: string; logo?: string };
  away: { id: string; name: string; short: string; logo?: string };
  score: number;
  modelP: number;
  leagueFreq: number;
  nLeague: number;
  nHome: number;
  nAway: number;
  confidence: number;
  sampleNote: string;
  commentary: string;
  impliedP: number | null;
  impliedNoVigP?: number | null;
  why: { label: string; value: string; n: number; layer: string }[];
};

function when(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });
}

export function HunterBoard({
  slug,
  label,
  short,
  rows,
  compact = false,
}: {
  slug: string;
  label: string;
  short: string;
  rows: BoardRow[];
  compact?: boolean;
}) {
  if (!rows.length) {
    return (
      <p className="rounded-lg border border-line bg-surface p-4 text-sm text-mist">
        Aucun match à venir avec une matrice de scores. Les fréquences historiques restent disponibles plus bas.
      </p>
    );
  }
  return (
    <ol className="space-y-3">
      {rows.map((row, i) => (
        <li key={row.matchId} className="min-w-0 rounded-lg border border-line bg-surface p-4 shadow-soft">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-pitch text-sm font-semibold tabular">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  to="/match/$matchId"
                  params={{ matchId: row.slug }}
                  className="min-w-0 break-words text-base font-semibold tracking-tight text-paper hover:text-sage"
                >
                  <span className="inline-flex items-center gap-2">
                    <Crest name={row.home.name} short={row.home.short} logo={row.home.logo} id={row.home.id} size={28} />
                    {row.home.name}
                    <span className="text-muted">–</span>
                    <Crest name={row.away.name} short={row.away.short} logo={row.away.logo} id={row.away.id} size={28} />
                    {row.away.name}
                  </span>
                </Link>
                <span className="rounded-md bg-header px-2.5 py-1 text-sm font-semibold tabular text-on-header">
                  {row.score}/100
                </span>
              </div>
              <p className="mt-1 text-xs text-muted">
                {LEAGUE_LABEL[row.league]} · {when(row.kickoff)}
                {row.status === "live" ? " · Live" : ""}
              </p>
              <p className="mt-2 text-sm text-mist">
                Estimation modèle {fmtPct(row.modelP)} · fréquence ligue {fmtPct(row.leagueFreq)} (n={row.nLeague})
              </p>
              {!compact ? (
                <>
                  <HunterWhy row={{ ...row, slug }} scenarioLabel={short} />
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <FollowStar kind="team" id={row.home.name} label={row.home.name} />
                    <FollowStar kind="team" id={row.away.name} label={row.away.name} />
                    <ShareHunter
                      title={`BetGPT ${label}`}
                      line={`${row.home.name} – ${row.away.name} · ${row.score}/100`}
                      path={`/score-hunter/${slug}`}
                    />
                  </div>
                </>
              ) : (
                <Link
                  to="/score-hunter/$scenario"
                  params={{ scenario: slug }}
                  className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-sage"
                >
                  Voir le classement
                </Link>
              )}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
