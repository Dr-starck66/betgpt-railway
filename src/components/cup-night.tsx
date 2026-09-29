import { Crest } from "@/components/crest";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { CupNightSim } from "@/engine/ticket-log";
import { LEAGUE_LABEL } from "@/lib/labels";
import { fmtSignedPct } from "@/lib/utils";

function euro(n: number, signed = false): string {
  const body = n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (!signed) return `${body}\u00a0€`;
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${Math.abs(n).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\u00a0€`;
}

function pickLabel(label: string): string {
  return label
    .replace("1 — Domicile", "Domicile")
    .replace("2 — Extérieur", "Extérieur")
    .replace("X — Nul", "Nul");
}

export function CupNight({ night }: { night: CupNightSim }) {
  const day = format(new Date(`${night.day}T12:00:00Z`), "EEEE d MMMM", { locale: fr });
  const name = LEAGUE_LABEL[night.league] ?? night.league;
  const win = night.profit >= 0;
  return (
    <section className="rounded-md border border-line bg-surface p-5 shadow-soft">
      <h2 className="text-xl font-bold tracking-tight">
        Soirée {name} · {day}
      </h2>
      <p className="mt-1 text-sm text-mist">
        Ce qu’il se serait passé avec 100&nbsp;€ le ticket + le filet, sur les mises C1 d’alors.
        Depuis : un seul ticket par match, pas de cote loterie, pas de club français, pas de nul.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-md bg-pitch px-3 py-3">
          <p className="text-xs text-muted">Misés</p>
          <p className="mt-1 font-bold tabular">{euro(night.staked)}</p>
        </div>
        <div className="rounded-md bg-pitch px-3 py-3">
          <p className="text-xs text-muted">Retours</p>
          <p className="mt-1 font-bold tabular">{euro(night.returned)}</p>
        </div>
        <div className={`rounded-md px-3 py-3 ${win ? "bg-sage/20" : "bg-rust/10"}`}>
          <p className="text-xs text-muted">Bénéfice</p>
          <p className={`mt-1 font-bold tabular ${win ? "text-ink" : "text-rust"}`}>{euro(night.profit, true)}</p>
        </div>
        <div className={`rounded-md px-3 py-3 ${win ? "bg-sage/20" : "bg-rust/10"}`}>
          <p className="text-xs text-muted">% bénéfice</p>
          <p className={`mt-1 font-bold tabular ${win ? "text-ink" : "text-rust"}`}>
            {fmtSignedPct(night.roi)}
          </p>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-[11px] font-bold uppercase tracking-wider text-muted">
              <th className="py-2 pr-3">Match</th>
              <th className="py-2 pr-3">Pari</th>
              <th className="py-2 pr-3">Score</th>
              <th className="py-2 pr-3">Filet</th>
              <th className="py-2 pr-3">Verdict</th>
              <th className="py-2 text-right">P&L</th>
            </tr>
          </thead>
          <tbody>
            {night.lines.map((l) => (
              <tr key={`${l.home}-${l.away}-${l.label}`} className="border-b border-line/70">
                <td className="py-2 pr-3 font-medium">
                  <span className="inline-flex items-center gap-2">
                    <Crest name={l.home} short={l.home.slice(0, 3)} size={22} />
                    <span>
                      {l.home} – {l.away}
                    </span>
                    <Crest name={l.away} short={l.away.slice(0, 3)} size={22} />
                  </span>
                </td>
                <td className="py-2 pr-3 tabular">
                  {pickLabel(l.label)} · {l.odds.toFixed(2).replace(".", ",")}
                </td>
                <td className="py-2 pr-3 tabular">{l.score}</td>
                <td className="py-2 pr-3 tabular">
                  {l.coverStake > 0
                    ? `${l.coverScore ?? "—"} · ${euro(l.coverStake)} ${l.coverReturn > 0 ? "OK" : "raté"}`
                    : "—"}
                </td>
                <td className="py-2 pr-3 capitalize">{l.verdict}</td>
                <td className={`py-2 text-right font-semibold tabular ${l.pnl >= 0 ? "text-paper" : "text-rust"}`}>
                  {euro(l.pnl, true)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
