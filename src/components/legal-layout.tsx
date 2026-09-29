import type { ReactNode } from "react";

export function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <div className="space-y-3 text-sm leading-relaxed text-paper">{children}</div>
    </article>
  );
}
