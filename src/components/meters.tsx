import { cn, fmtOdds, fmtPct } from "@/lib/utils";

export function ProbBar({
  home,
  draw,
  away,
  homeLabel = "1",
  awayLabel = "2",
  homeOdds,
  drawOdds,
  awayOdds,
}: {
  home: number;
  draw: number;
  away: number;
  homeLabel?: string;
  awayLabel?: string;
  homeOdds?: number;
  drawOdds?: number;
  awayOdds?: number;
}) {
  const cells = [
    { k: "1", name: homeLabel, p: home, odds: homeOdds },
    { k: "N", name: "Nul", p: draw, odds: drawOdds },
    { k: "2", name: awayLabel, p: away, odds: awayOdds },
  ];
  const max = Math.max(home, draw, away);
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {cells.map((c) => {
        const hot = c.p === max;
        return (
          <div
            key={c.k}
            className={cn(
              "rounded-md px-2 py-2 text-center",
              hot ? "bg-sage text-ink" : "border border-line bg-surface text-paper",
            )}
          >
            <div className={cn("text-[10px] font-bold uppercase tracking-wider", hot ? "text-ink/70" : "text-muted")}>
              {c.k}
            </div>
            <div className="mt-0.5 tabular text-sm font-bold">{fmtPct(c.p, 0)}</div>
            {c.odds ? (
              <div className="mt-0.5 font-mono text-[11px] tabular">{fmtOdds(c.odds)}</div>
            ) : (
              <div className="mt-0.5 text-[11px] opacity-70">{c.name}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function Meter({
  value,
  label,
  tone = "paper",
}: {
  value: number;
  label: string;
  tone?: "paper" | "sage" | "clay" | "rust";
}) {
  const color =
    tone === "sage"
      ? "bg-sage"
      : tone === "clay"
        ? "bg-clay"
        : tone === "rust"
          ? "bg-rust"
          : "bg-paper";
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-muted">
        <span>{label}</span>
        <span className="tabular text-paper">{Math.round(value * 100)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-line">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${value * 100}%` }} />
      </div>
    </div>
  );
}
