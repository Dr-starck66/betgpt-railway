import { createFileRoute, Link } from "@tanstack/react-router";
import { TeamLine } from "@/components/crest";
import { BookLinks } from "@/components/book-links";
import { CoconMesh } from "@/components/cocon-mesh";
import { getPublicDesk } from "@/lib/desk.functions";
import { COCON_MERES } from "@/lib/cocon";
import { bestThreeWay } from "@/lib/money";
import { SITE_URL } from "@/lib/programmatic";
import { fmtOdds } from "@/lib/utils";
import { ld } from "@/lib/ld";

export const Route = createFileRoute("/meilleures-cotes")({
  loader: () => getPublicDesk(),
  head: () => ({
    meta: [
      { title: "Meilleures cotes football du jour France | BetGPT" },
      {
        name: "description",
        content:
          "Comparatif des meilleures cotes 1N2 en France : Unibet, Betclic, Winamax, Bet365, NetBet. Clique et prends la plus haute.",
      },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/meilleures-cotes` }],
  }),
  component: BestOdds,
});

function BestOdds() {
  const data = Route.useLoaderData();
  const rows = data.matches
    .filter((m) => m.status !== "finished")
    .map((m) => ({ m, best: bestThreeWay(m) }))
    .filter((x): x is { m: (typeof data.matches)[0]; best: NonNullable<ReturnType<typeof bestThreeWay>> } => Boolean(x.best));
  return (
    <article className="space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: ld({
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: "Meilleures cotes football France",
            numberOfItems: rows.length,
          }),
        }}
      />
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Meilleures cotes football du jour</h1>
        <p className="seo-answer mt-2 max-w-3xl text-sm text-paper">
          Pour chaque match, la plus haute cote 1, N et 2 chez les books FR. Un parieur sérieux ne laisse pas 10 centimes sur la table.
        </p>
      </header>
      <CoconMesh
        crumbs={[
          { name: "BetGPT", href: "/" },
          { name: "Meilleures cotes", href: "/meilleures-cotes" },
        ]}
        parent={{ href: "/pari-du-jour", anchor: "Pari du jour", rel: "parent" }}
        sisters={COCON_MERES.map((m) => ({ href: m.path, anchor: m.title, rel: "sister" as const }))}
        children={rows.slice(0, 8).map(({ m }) => ({
          href: `/cotes/${m.slug ?? m.id}`,
          anchor: `Cote ${m.home.name} – ${m.away.name}`,
          rel: "child" as const,
        }))}
      />
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-raised text-left text-[11px] uppercase tracking-wider text-muted">
            <tr>
              <th className="px-3 py-2">Match</th>
              <th className="px-3 py-2">1</th>
              <th className="px-3 py-2">N</th>
              <th className="px-3 py-2">2</th>
              <th className="px-3 py-2">Parier</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ m, best }) => {
              const p = data.predictions.find((x) => x.matchId === m.id);
              return (
                <tr key={m.id} className="border-t border-line">
                  <td className="px-3 py-2">
                    <Link to="/cotes/$matchId" params={{ matchId: m.slug ?? m.id }} className="font-medium hover:text-sage">
                      <TeamLine home={m.home} away={m.away} size={22} names="short" competition={m.competition} />
                    </Link>
                  </td>
                  <td className="px-3 py-2 tabular">
                    {fmtOdds(best.home.odds)} <span className="text-muted">{best.home.book}</span>
                  </td>
                  <td className="px-3 py-2 tabular">
                    {fmtOdds(best.draw.odds)} <span className="text-muted">{best.draw.book}</span>
                  </td>
                  <td className="px-3 py-2 tabular">
                    {fmtOdds(best.away.odds)} <span className="text-muted">{best.away.book}</span>
                  </td>
                  <td className="px-3 py-2">{p ? <BookLinks links={p.bookLinks} compact matchId={m.id} /> : null}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">18+. Comparatif informatif, pas un conseil personnalisé.</p>
    </article>
  );
}
