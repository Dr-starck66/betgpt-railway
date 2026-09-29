import type { CoverBet as CoverBetType } from "@/engine/types";
import { trackedUrl } from "@/lib/track";
import { fmtOdds, fmtPct, fmtSignedPct } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function CoverBet({
  cover,
  compact,
  matchId,
}: {
  cover: CoverBetType;
  compact?: boolean;
  matchId?: string;
}) {
  const filetEur = 10 / (2 * cover.odds - 1);
  return (
    <div className={cn("rounded-md border border-line bg-raised/80", compact ? "px-2 py-2" : "px-3 py-3")}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
        Couverture 50 % · score exact {cover.selection}
      </p>
      <p className={cn("mt-0.5 font-medium text-paper", compact ? "text-xs" : "text-sm")}>{cover.selection}</p>
      <p className={cn("tabular text-mist", compact ? "text-[11px]" : "text-sm")}>
        {fmtOdds(cover.odds)} · {cover.listed ? cover.book : "cote non listée"}
      </p>
      {cover.stakePct > 0 ? (
        <p className={cn("mt-1 tabular text-mist", compact ? "text-[11px]" : "text-sm")}>
          Filet {fmtPct(cover.stakePct)} · total {fmtPct(cover.totalStakePct)}
        </p>
      ) : (
        <p className={cn("mt-1 tabular text-mist", compact ? "text-[11px]" : "text-sm")}>
          Si 10 € misés → filet {filetEur.toFixed(2).replace(".", ",")} €
        </p>
      )}
      {!compact ? (
        <p className="mt-1 text-sm tabular">
          <span className="text-sage">Pari OK {fmtSignedPct(cover.ifMainWins)}</span>
          <span className="text-muted"> · </span>
          <span className="text-paper">Filet OK {fmtSignedPct(cover.ifCoverWins)}</span>
        </p>
      ) : null}
      {cover.url && cover.listed ? (
        <a
          href={trackedUrl(cover.book, cover.url, matchId)}
          rel="noopener noreferrer sponsored"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "mt-1 inline-flex items-center text-sage hover:text-paper",
            compact ? "min-h-8 text-[11px]" : "min-h-10 text-sm",
          )}
          target="_blank"
        >
          Parier le {cover.selection}
        </a>
      ) : null}
    </div>
  );
}
