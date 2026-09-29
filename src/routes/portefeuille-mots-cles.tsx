import { createFileRoute } from "@tanstack/react-router";
import { getPublicDesk } from "@/lib/desk.functions";
import { MONEY_KEYWORDS, bankableScore, fixtureKeywords } from "@/lib/seo/money-map";
import { SITE_URL } from "@/lib/programmatic";

export const Route = createFileRoute("/portefeuille-mots-cles")({
  loader: () => getPublicDesk(),
  head: () => ({
    meta: [
      { title: "Portefeuille de requêtes | BetGPT" },
      { name: "description", content: "Priorités éditoriales internes. Volume, CPC et position Google sont inconnus." },
      { name: "robots", content: "noindex, follow" },
      { property: "og:url", content: `${SITE_URL}/portefeuille-mots-cles` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/portefeuille-mots-cles` }],
  }),
  component: Page,
});

function Page() {
  const desk = Route.useLoaderData();
  const rows = [...MONEY_KEYWORDS, ...fixtureKeywords(desk.matches)];
  return (
    <article className="space-y-4">
      <h1 className="text-2xl font-semibold">Portefeuille de requêtes</h1>
      <p className="text-sm text-mist">
        Volume, CPC, difficulté et position actuelle sont UNKNOWN : aucune source mesurée n’est branchée. Le score sert à prioriser la rédaction, ce n’est pas une métrique Google.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="text-xs uppercase text-muted">
            <tr>
              <th className="px-2 py-1">Requête</th>
              <th className="px-2 py-1">Intention</th>
              <th className="px-2 py-1">URL</th>
              <th className="px-2 py-1">Volume</th>
              <th className="px-2 py-1">Score</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((k) => (
              <tr key={k.keyword} className="border-t border-line">
                <td className="px-2 py-1">{k.keyword}</td>
                <td className="px-2 py-1">{k.intent}</td>
                <td className="px-2 py-1">{k.targetURL ?? "pas de page"}</td>
                <td className="px-2 py-1">{k.volume}</td>
                <td className="px-2 py-1 tabular">{bankableScore(k).score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}
