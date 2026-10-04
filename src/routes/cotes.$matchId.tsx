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
import { bookmakerDestination } from "@/lib/bookmaker-url";

function BestSideCta({
  side,
  label,
  line,
  match,
}: {
  side: "1" | "N" | "2";
  label: string;
  line: { odds: number; book: string; url?: string };
  match: Parameters<typeof bestThreeWay>[0];
}) {
  const href = bookmakerDestination(line.book, match.league, line.url);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Voir la meilleure cote ${side} chez ${line.book}, ${fmtOdds(line.odds)}`}
      title={`Ouvrir ${line.book} · ${label} · cote ${fmtOdds(line.odds)} · 18+`}
      className="group flex min-h-24 flex-col justify-between rounded-2xl border border-sage/70 bg-sage p-4 text-ink shadow-[0_12px_30px_rgba(124,194,58,0.2)] transition hover:-translate-y-0.5 hover:brightness-95"
    >
      <span className="text-[10px] font-black uppercase tracking-[0.14em]">Meilleure cote {side}</span>
      <span className="mt-2 text-2xl font-black tabular">{fmtOdds(line.odds)}</span>
      <span className="mt-1 text-sm font-bold">{line.book}</span>
      <span className="mt-3 text-xs font-black uppercase tracking-[0.08em]">Voir la cote →</span>
    </a>
  );
}

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
      {best ? (
        <section aria-label={`Meilleures cotes ${vs}`} className="grid gap-3 sm:grid-cols-3">
          <BestSideCta side="1" label={match.home.name} line={best.home} match={match} />
          <BestSideCta side="N" label="Match nul" line={best.draw} match={match} />
          <BestSideCta side="2" label={match.away.name} line={best.away} match={match} />
        </section>
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-raised text-left text-[11px] uppercase text-muted">
            <tr>
              <th className="px-3 py-2">Book</th>
              <th className="px-3 py-2">1</th>
              <th className="px-3 py-2">N</th>
              <th className="px-3 py-2">2</th>
              <th className="px-3 py-2">Accès bookmaker</th>
            </tr>
          </thead>
          <tbody>
            {books.map((b) => {
              const href = bookmakerDestination(
                b.book,
                match.league,
                b.url ?? b.homeUrl ?? b.drawUrl ?? b.awayUrl,
              );
              return (
                <tr key={b.book} className="border-t border-line">
                  <td className="px-3 py-2 font-semibold">{b.book}</td>
                  <td className="px-3 py-2 tabular">{fmtOdds(b.home)}</td>
                  <td className="px-3 py-2 tabular">{fmtOdds(b.draw)}</td>
                  <td className="px-3 py-2 tabular">{fmtOdds(b.away)}</td>
                  <td className="px-3 py-2">
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-xl border border-sage/60 bg-sage px-3 text-xs font-black text-ink shadow-sm transition hover:-translate-y-0.5 hover:brightness-95"
                        aria-label={`Ouvrir les cotes chez ${b.book}`}
                      >
                        Voir {b.book} →
                      </a>
                    ) : (
                      <span className="text-xs text-muted">Lien indisponible</span>
                    )}
                  </td>
                </tr>
              );
            })}
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
