import type { ReactNode } from "react";
import type { Decision } from "@/engine/types";
import { DECISION_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";

export function Badge({
  children,
  tone = "mist",
  className,
}: {
  children: ReactNode;
  tone?: "mist" | "sage" | "clay" | "rust" | "paper";
  className?: string;
}) {
  const tones = {
    mist: "text-mist border-line bg-raised",
    sage: "text-ink border-sage bg-sage",
    clay: "text-ink border-clay bg-clay",
    rust: "text-on-header border-rust bg-rust",
    paper: "text-paper border-line bg-pitch",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function DecisionBadge({ decision }: { decision: Decision }) {
  const tone = decision === "BET" ? "sage" : decision === "WATCH" ? "clay" : "rust";
  return <Badge tone={tone}>{DECISION_LABEL[decision]}</Badge>;
}

export function PremiumBadge() {
  return (
    <Badge tone="sage">Premium</Badge>
  );
}

export function VerdictBadge({ verdict }: { verdict: "gagnant" | "perdant" | "void" | "en_cours" | "attente" | "aucun" }) {
  if (verdict === "gagnant") return <Badge tone="sage">Gagnant</Badge>;
  if (verdict === "perdant") return <Badge tone="rust">Perdant</Badge>;
  if (verdict === "void") return <Badge tone="clay">Remboursé</Badge>;
  if (verdict === "en_cours") return <Badge tone="clay">En cours</Badge>;
  if (verdict === "attente") return <Badge tone="mist">À jouer</Badge>;
  return <Badge tone="mist">—</Badge>;
}
