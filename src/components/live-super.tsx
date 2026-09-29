import type { LiveSuperBet } from "@/engine/types";
import { fmtPct } from "@/lib/utils";

export function LiveSuperCard({ bet }: { bet: LiveSuperBet }) {
  return (
    <section className="rounded-xl border border-sage bg-surface p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sage">Super pari live · {bet.minute}e</p>
      <h2 className="mt-1 text-lg font-semibold tracking-tight">{bet.pick}</h2>
      <p className="mt-2 text-sm leading-relaxed text-paper">{bet.why}</p>
      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-md border border-line px-3 py-2">
          <dt className="text-[11px] uppercase tracking-wider text-muted">Lecture</dt>
          <dd className="font-medium">{fmtPct(bet.p)}</dd>
        </div>
        <div className="rounded-md border border-line px-3 py-2">
          <dt className="text-[11px] uppercase tracking-wider text-muted">Filet</dt>
          <dd className="font-medium">{bet.cover}</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-muted">Pas une cote live de book. C’est ce que le terrain dit, maintenant.</p>
    </section>
  );
}
