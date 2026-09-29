import type { MatchInput } from "@/engine/types";
import { useScoreTick } from "@/lib/score-bus";
import { cn } from "@/lib/utils";

export function LiveScore({
  match,
  size = "md",
  stale = false,
}: {
  match: MatchInput;
  size?: "sm" | "md" | "lg";
  stale?: boolean;
}) {
  const tick = useScoreTick(match.id, {
    id: match.id,
    h: match.scoreHome ?? 0,
    a: match.scoreAway ?? 0,
    clock: match.clock,
    status: match.status,
  });
  const live = (tick.status ?? match.status) === "live";
  const done = (tick.status ?? match.status) === "finished";
  if (!live && !done) return null;
  const h = tick.h;
  const a = tick.a;
  const seeded = typeof match.scoreHome === "number" && typeof match.scoreAway === "number";
  const show = seeded || h !== (match.scoreHome ?? 0) || a !== (match.scoreAway ?? 0);
  const num = size === "lg" ? "text-4xl sm:text-5xl" : size === "sm" ? "text-lg" : "text-2xl";
  return (
    <div className={cn("flex items-center gap-3 tabular", size === "lg" && "gap-4")}>
      <p className={cn("font-semibold tracking-tight text-paper", num)}>
        {show ? h : "—"}
        <span className="mx-1 text-muted">–</span>
        {show ? a : "—"}
      </p>
      {live && stale ? (
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">Dernier score{tick.clock ? ` · ${tick.clock}` : ""}</span>
      ) : live ? (
        <span className="inline-flex items-center gap-1.5 rounded-sm bg-sage px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ink/50" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-ink" />
          </span>
          Live{tick.clock ? ` · ${tick.clock}` : ""}
        </span>
      ) : (
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">Terminé</span>
      )}
    </div>
  );
}