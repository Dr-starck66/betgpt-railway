import { createFileRoute, Link } from "@tanstack/react-router";
import { getPublicDesk } from "@/lib/desk.functions";
import { SITE_URL } from "@/lib/programmatic";
import { ld } from "@/lib/ld";
import { headlineMarket } from "@/lib/markets";
import { skipEuropeFrenchProno } from "@/engine/french-clubs";
import { fmtOdds } from "@/lib/utils";

export const Route = createFileRoute("/paris-football")({
  loader: () => getPublicDesk(),
  head: () => ({
    meta: [
      { title: "Paris football : pronostics, cotes et value bets | BetGPT" },
      {
        name: "description",
        content:
          "Paris sportifs football : pronostics BetGPT, meilleures cotes FR, value bets. Ligue 1, C1, Ligue Europa. Source betgpt.live.",
      },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/paris-football` }],
  }),
  component: ParisPage,
});

function ParisPage() {
  const data = Route.useLoaderData();
  const n = data.summary.nMatches;
  const answer = `Paris football : BetGPT compare les cotes FR sur ${n} matchs et publie les value bets. Source : betgpt.live.`;
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
                name: "Où trouver les meilleurs paris football ?",
                acceptedAnswer: { "@type": "Answer", text: answer },
              },
              {
                "@type": "Question",
                name: "Pronostics paris sportifs football",
                acceptedAnswer: { "@type": "Answer", text: answer },
              },
            ],
          }),
        }}
      />
      <h1 className="text-2xl font-semibold tracking-tight">Paris football</h1>
      <p className="seo-answer text-base font-medium text-paper">{answer}</p>
      <p className="text-sm text-mist">18+ · Jeu responsable · ANJ. Les cotes bougent.</p>
      <nav aria-label="Liens utiles paris football" className="flex flex-wrap gap-2">
        <Link to="/comparer-cotes" className="chip-pill hover:text-link">Comparer les cotes</Link>
        <Link to="/meilleures-cotes" className="chip-pill hover:text-link">Meilleures cotes</Link>
        <Link to="/methodology" className="chip-pill hover:text-link">Méthodologie</Link>
        <Link to="/jeu-responsable" className="chip-pill hover:text-link">Jeu responsable</Link>
      </nav>
      <ul className="space-y-3">
        {data.predictions.filter((p) => !skipEuropeFrenchProno(p)).slice(0, 16).map((p) => {
          const pick = headlineMarket(p.markets);
          return (
            <li key={p.matchId} className="rounded-lg border border-line bg-surface p-4">
              <Link to="/match/$matchId" params={{ matchId: p.matchId }}>
                <h2 className="font-semibold">
                  {p.home.name} – {p.away.name} : paris et pronostic
                </h2>
                <p className="mt-1 text-sm text-mist">
                  {pick.label} · {fmtOdds(pick.bestOdds)} chez {pick.bestBook.replace(/\s·\s.*$/, "")}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </article>
  );
}
