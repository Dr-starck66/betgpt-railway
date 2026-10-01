import type { ReactNode } from "react";
import { ArrowUpRight, ShieldCheck, Sparkles } from "lucide-react";

export type AstraWingLink = {
  href: string;
  label: string;
  description?: string;
  eyebrow?: string;
};

export type AstraWingStat = {
  label: string;
  value: string;
  detail?: string;
};

export type AstraWing = {
  eyebrow?: string;
  title: string;
  intro?: string;
  links?: AstraWingLink[];
  stats?: AstraWingStat[];
};

export function AstraSidewings({
  children,
  left,
  right,
  ariaLabel = "Navigation et contexte de la page",
}: {
  children: ReactNode;
  left?: AstraWing;
  right?: AstraWing;
  ariaLabel?: string;
}) {
  return (
    <div
      className="mx-auto grid w-full max-w-[1380px] items-start gap-5 md:grid-cols-2 xl:grid-cols-[240px_minmax(0,760px)_280px] 2xl:grid-cols-[260px_minmax(0,820px)_300px]"
      aria-label={ariaLabel}
    >
      {left ? (
        <aside className="order-2 min-w-0 xl:order-1 xl:sticky xl:top-28">
          <WingPanel wing={left} icon="spark" />
        </aside>
      ) : null}

      <div className="order-1 min-w-0 md:col-span-2 xl:order-2 xl:col-span-1">{children}</div>

      {right ? (
        <aside className="order-3 min-w-0 xl:sticky xl:top-28">
          <WingPanel wing={right} icon="shield" />
        </aside>
      ) : null}
    </div>
  );
}

function WingPanel({ wing, icon }: { wing: AstraWing; icon: "spark" | "shield" }) {
  const Icon = icon === "shield" ? ShieldCheck : Sparkles;

  return (
    <section className="overflow-hidden rounded-[1.35rem] border border-line bg-surface shadow-[0_14px_40px_rgba(15,23,42,0.06)]">
      <div className="border-b border-line/80 bg-slate-50/70 px-4 py-4">
        <div className="flex items-center gap-2 text-sage">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-sage/10">
            <Icon size={16} aria-hidden="true" />
          </span>
          {wing.eyebrow ? (
            <p className="text-[10px] font-bold uppercase tracking-[0.16em]">{wing.eyebrow}</p>
          ) : null}
        </div>
        <h2 className="mt-3 text-[17px] font-extrabold tracking-tight text-paper">{wing.title}</h2>
        {wing.intro ? <p className="mt-2 text-sm leading-6 text-mist">{wing.intro}</p> : null}
      </div>

      {wing.stats?.length ? (
        <dl className="grid gap-2 border-b border-line/80 p-3">
          {wing.stats.map((stat) => (
            <div key={`${stat.label}-${stat.value}`} className="rounded-xl border border-line/70 bg-white px-3 py-3">
              <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">{stat.label}</dt>
              <dd className="mt-1 text-sm font-extrabold text-paper">{stat.value}</dd>
              {stat.detail ? <p className="mt-1 text-xs leading-5 text-muted">{stat.detail}</p> : null}
            </div>
          ))}
        </dl>
      ) : null}

      {wing.links?.length ? (
        <nav className="grid gap-1.5 p-3" aria-label={wing.title}>
          {wing.links.map((link) => (
            <a
              key={`${link.href}-${link.label}`}
              href={link.href}
              className="group rounded-xl px-3 py-3 transition-colors hover:bg-slate-50"
            >
              {link.eyebrow ? (
                <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-sage">
                  {link.eyebrow}
                </span>
              ) : null}
              <span className="mt-0.5 flex items-start justify-between gap-3 text-sm font-bold text-paper">
                <span>{link.label}</span>
                <ArrowUpRight
                  size={15}
                  className="mt-0.5 shrink-0 text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-sage"
                  aria-hidden="true"
                />
              </span>
              {link.description ? (
                <span className="mt-1 block text-xs leading-5 text-muted">{link.description}</span>
              ) : null}
            </a>
          ))}
        </nav>
      ) : null}
    </section>
  );
}
