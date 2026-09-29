import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { BookLinks } from "@/components/book-links";
import { CoconMesh } from "@/components/cocon-mesh";
import { getMatchDesk } from "@/lib/desk.functions";
import { meshMatch } from "@/lib/cocon";
import { bestThreeWay, booksSorted } from "@/lib/money";
import { SITE_URL } from "@/lib/programmatic";
import { matchPath } from "@/lib/seo";
import { fmtOdds } from "@/lib/utils";
import { ld } from "@/lib/ld";

export const Route = createFileRoute("/cotes/$matchId")({
  loader: async ({ params }) => {
    const data = await getMatchDesk({ data: { id: params.matchId } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const { match } = loaderData;
    const vs = `${match.home.name} – ${match.away.name}`;
    const title = `Cote ${vs} : comparatif books France | BetGPT`;
    return {
      meta: [
        { title },
        { name: "description", content: `Meilleure cote ${vs}. 1N2 comparé chez les books FR. Parier au plus haut prix.` },
        { property: "og:url", content: `${SITE_URL}/cotes/${match.slug ?? match.id}` },
      ],
      links: [{ rel: "canonical", href: `${SITE_URL}/cotes/${match.slug ?? match.id}` }],
    };
  },
  component: CotesPage,
  notFoundComponent: () => (
    <p className="text-sm text-muted">
      Cotes indisponibles pour cette affiche.{" "}
      <Link to="/meilleures-cotes" className="text-sage hover:underline">
        Meilleures cotes
      </Link>
      {" · "}
      <Link to="/scores-en-direct" className="text-sage hover:underline">
        Scores en direct
      </Link>
      .
    </p>
  ),
});

function CotesPage() {
  const { match, prediction, sisters } = Route.useLoaderData();
  const best = bestThreeWay(match);
  const books = booksSorted(match);
  const vs = `${match.home.name} – ${match.away.name}`;
  return (
    <article className="space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: ld({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: [
              {
                "@type": "Question",
                name: `Quelle est la meilleure cote ${vs} ?`,
                acceptedAnswer: {
                  "@type": "Answer",
                  text: best
                    ? `1 ${best.home.odds} ${best.home.book}, N ${best.draw.odds} ${best.draw.book}, 2 ${best.away.odds} ${best.away.book}.`
                    : "Cotes en cours de collecte.",
                },
              },
            ],
          }),
        }}
      />
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Cote {vs} : comparatif France</h1>
        <p className="seo-answer mt-2 text-sm text-paper">
          {best
            ? `Meilleure cote ${vs} : 1 à ${fmtOdds(best.home.odds)} (${best.home.book}), nul ${fmtOdds(best.draw.odds)} (${best.draw.book}), 2 ${fmtOdds(best.away.odds)} (${best.away.book}).`
            : `Cotes ${vs} en cours.`}{" "}
          <Link to="/match/$matchId" params={{ matchId: match.slug ?? match.id }} className="text-sage hover:underline">
            Pronostic et analyse {vs}
          </Link>
          .
        </p>
      </header>
      <CoconMesh {...meshMatch(match, sisters ?? [])} />
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-raised text-left text-[11px] uppercase text-muted">
            <tr>
              <th className="px-3 py-2">Book</th>
              <th className="px-3 py-2">1</th>
              <th className="px-3 py-2">N</th>
              <th className="px-3 py-2">2</th>
            </tr>
          </thead>
          <tbody>
            {books.map((b) => (
              <tr key={b.book} className="border-t border-line">
                <td className="px-3 py-2">{b.book}</td>
                <td className="px-3 py-2 tabular">{fmtOdds(b.home)}</td>
                <td className="px-3 py-2 tabular">{fmtOdds(b.draw)}</td>
                <td className="px-3 py-2 tabular">{fmtOdds(b.away)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <BookLinks links={prediction.bookLinks} matchId={match.id} />
      <p className="text-xs text-muted">
        Page cote, pas l’analyse. Analyse : <a href={matchPath(match)} className="text-sage">{vs}</a>. 18+.
      </p>
    </article>
  );
}
