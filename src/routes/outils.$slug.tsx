import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { SITE_URL } from "@/lib/programmatic";

const TOOLS = ["value-bet", "kelly", "convertisseur-cotes", "roi"] as const;
type Tool = (typeof TOOLS)[number];

const COPY: Record<Tool, { title: string; description: string; h1: string }> = {
  "value-bet": {
    title: "Calculateur value bet | BetGPT",
    description: "Calcule la probabilité implicite, l’écart et l’espérance à partir d’une cote et d’une probabilité que tu fournis.",
    h1: "Calculateur d’écart (value)",
  },
  kelly: {
    title: "Calculateur Kelly | BetGPT",
    description: "Kelly complet, demi-Kelly et quart-Kelly. Une fraction négative signifie que la formule ne mise pas.",
    h1: "Calculateur Kelly",
  },
  "convertisseur-cotes": {
    title: "Convertisseur de cotes | BetGPT",
    description: "Convertit une cote décimale en probabilité implicite, cote américaine et fraction approchée.",
    h1: "Convertisseur de cotes",
  },
  roi: {
    title: "Calculateur de ROI | BetGPT",
    description: "ROI = (retours − mises) / mises, sur les montants que tu saisis. Aucun historique n’est inventé.",
    h1: "Calculateur de ROI",
  },
};

export const Route = createFileRoute("/outils/$slug")({
  loader: ({ params }) => {
    if (!TOOLS.includes(params.slug as Tool)) throw notFound();
    return { slug: params.slug as Tool };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const copy = COPY[loaderData.slug];
    const url = `${SITE_URL}/outils/${loaderData.slug}`;
    return {
      meta: [
        { title: copy.title },
        { name: "description", content: copy.description },
        { name: "robots", content: "index, follow" },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  notFoundComponent: () => <p className="text-muted">Outil introuvable.</p>,
  component: Page,
});

function num(raw: string): number | null {
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function Page() {
  const { slug } = Route.useLoaderData();
  const copy = COPY[slug];
  const [odds, setOdds] = useState("2.10");
  const [prob, setProb] = useState("0.52");
  const [staked, setStaked] = useState("100");
  const [returned, setReturned] = useState("96");
  const out = useMemo(() => {
    const d = num(odds);
    const p = num(prob);
    if (slug === "roi") {
      const s = num(staked);
      const r = num(returned);
      if (s == null || r == null || s <= 0) return "Saisis une mise totale strictement positive.";
      const roi = (r - s) / s;
      return `ROI ${(roi * 100).toFixed(1).replace(".", ",")} %. Profit ${(r - s).toFixed(2)} pour ${s.toFixed(2)} misés.`;
    }
    if (d == null || d <= 1) return "La cote décimale doit être supérieure à 1.";
    const implied = 1 / d;
    if (slug === "convertisseur-cotes") {
      const american = d >= 2 ? Math.round((d - 1) * 100) : Math.round(-100 / (d - 1));
      const profit = d - 1;
      return `Implicite brute ${(implied * 100).toFixed(1).replace(".", ",")} %. Américaine ${american > 0 ? "+" : ""}${american}. Fraction de profit ≈ ${profit.toFixed(2)}/1.`;
    }
    if (p == null || p <= 0 || p >= 1) return "La probabilité doit être strictement entre 0 et 1.";
    const edge = p - implied;
    const ev = p * d - 1;
    if (slug === "value-bet") {
      return `Implicite ${(implied * 100).toFixed(1).replace(".", ",")} %. Écart ${(edge * 100).toFixed(1).replace(".", ",")} points. Espérance ${ev.toFixed(3)} par unité misee. Ce n’est pas un gain attendu certain.`;
    }
    const b = d - 1;
    const full = (b * p - (1 - p)) / b;
    return `Kelly ${(full * 100).toFixed(2).replace(".", ",")} %. Demi ${(full * 50).toFixed(2).replace(".", ",")} %. Quart ${(full * 25).toFixed(2).replace(".", ",")} %. ${full <= 0 ? "Fraction négative ou nulle : la formule ne mise pas." : "Ce n’est pas une recommandation de bankroll."}`;
  }, [odds, prob, returned, slug, staked]);
  return (
    <article className="max-w-xl space-y-4">
      <p className="text-xs text-muted">
        <Link to="/outils">Outils</Link>
      </p>
      <h1 className="text-2xl font-semibold">{copy.h1}</h1>
      <p className="text-sm text-mist">{copy.description}</p>
      {slug !== "roi" ? (
        <label className="block text-sm">
          Cote décimale
          <input value={odds} onChange={(e) => setOdds(e.target.value)} className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2" inputMode="decimal" />
        </label>
      ) : null}
      {slug === "value-bet" || slug === "kelly" ? (
        <label className="block text-sm">
          Probabilité estimée (0–1)
          <input value={prob} onChange={(e) => setProb(e.target.value)} className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2" inputMode="decimal" />
        </label>
      ) : null}
      {slug === "roi" ? (
        <>
          <label className="block text-sm">
            Mises totales
            <input value={staked} onChange={(e) => setStaked(e.target.value)} className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2" inputMode="decimal" />
          </label>
          <label className="block text-sm">
            Retours totaux
            <input value={returned} onChange={(e) => setReturned(e.target.value)} className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2" inputMode="decimal" />
          </label>
        </>
      ) : null}
      <p className="rounded-lg border border-line bg-surface p-4 text-sm">{out}</p>
      <p className="text-xs text-muted">
        18+. <Link to="/guides/$slug" params={{ slug: "value-bet" }}>Lire les limites</Link>.
      </p>
    </article>
  );
}
