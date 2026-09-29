import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { TeamLine } from "@/components/crest";
import { CoconMesh } from "@/components/cocon-mesh";
import { getPublicDesk } from "@/lib/desk.functions";
import { COCON_MERES } from "@/lib/cocon";
import { kellyFraction } from "@/lib/money";
import { headlineMarket } from "@/lib/markets";
import { SITE_URL } from "@/lib/programmatic";
import { fmtOdds, fmtPct } from "@/lib/utils";

export const Route = createFileRoute("/calculateur-mise")({
  loader: () => getPublicDesk(),
  head: () => ({
    meta: [
      { title: "Calculateur de mise Kelly football | BetGPT" },
      {
        name: "description",
        content:
          "Calcule ta mise (fraction de Kelly) sur les value bets BetGPT. Bankroll, cote, proba modèle. Pour parieurs qui gèrent un roll.",
      },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/calculateur-mise` }],
  }),
  component: KellyPage,
});

function KellyPage() {
  const data = Route.useLoaderData();
  const [bank, setBank] = useState("500");
  const bets = useMemo(
    () =>
      data.predictions
        .map((p) => ({ p, m: headlineMarket(p.markets) }))
        .filter((x) => x.m.decision === "BET" || x.m.premium)
        .slice(0, 12),
    [data.predictions],
  );
  const roll = Math.max(0, Number(bank.replace(",", ".")) || 0);
  return (
    <article className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Calculateur de mise (Kelly)</h1>
        <p className="seo-answer mt-2 max-w-3xl text-sm text-paper">
          Un gros parieur ne mise pas 2,5 % partout. Ici la mise suit la cote et la proba. Plafond 8 % du roll.
        </p>
      </header>
      <CoconMesh
        crumbs={[
          { name: "BetGPT", href: "/" },
          { name: "Calculateur de mise", href: "/calculateur-mise" },
        ]}
        parent={{ href: "/pari-du-jour", anchor: "Pari du jour", rel: "parent" }}
        sisters={COCON_MERES.map((m) => ({ href: m.path, anchor: m.title, rel: "sister" as const }))}
        children={[{ href: "/opportunities", anchor: "Opportunités", rel: "child" }]}
      />
      <label className="block max-w-xs text-sm">
        Bankroll (€)
        <input
          value={bank}
          onChange={(e) => setBank(e.target.value)}
          className="mt-1 block w-full rounded-md border border-line bg-surface px-3 py-2"
        />
      </label>
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="bg-raised text-left text-[11px] uppercase tracking-wider text-muted">
            <tr>
              <th className="px-3 py-2">Ticket</th>
              <th className="px-3 py-2">Cote</th>
              <th className="px-3 py-2">Proba</th>
              <th className="px-3 py-2">Kelly</th>
              <th className="px-3 py-2">Mise</th>
            </tr>
          </thead>
          <tbody>
            {bets.map(({ p, m }) => {
              const k = kellyFraction(m.modelProb, m.bestOdds);
              const stake = roll * k;
              return (
                <tr key={p.matchId + m.market} className="border-t border-line">
                  <td className="px-3 py-2">
                    <Link to="/match/$matchId" params={{ matchId: p.matchId }} className="hover:text-sage">
                      <TeamLine home={p.home} away={p.away} size={22} names="short" />
                    </Link>
                    <span className="ml-2 text-mist">{m.label}</span>
                  </td>
                  <td className="px-3 py-2 tabular">{fmtOdds(m.bestOdds)}</td>
                  <td className="px-3 py-2 tabular">{fmtPct(m.modelProb)}</td>
                  <td className="px-3 py-2 tabular">{fmtPct(k)}</td>
                  <td className="px-3 py-2 tabular font-medium">{stake.toFixed(1)} €</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">Demi-Kelly mental : divise par deux si tu n’es pas une machine. 18+.</p>
    </article>
  );
}
