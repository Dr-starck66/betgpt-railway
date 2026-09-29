import { createFileRoute, Link } from "@tanstack/react-router";
import { DailyBest } from "@/components/daily-best";
import { BookLinks, PrimaryParier } from "@/components/book-links";
import { CoconMesh } from "@/components/cocon-mesh";
import { CoverBet } from "@/components/cover-bet";
import { getPublicDesk } from "@/lib/desk.functions";
import { matchPick, MIN_BET_ODDS } from "@/lib/markets";
import { COCON_MERES } from "@/lib/cocon";
import { SITE_URL } from "@/lib/programmatic";
import { fmtOdds, fmtPct } from "@/lib/utils";
import { ld } from "@/lib/ld";

export const Route = createFileRoute("/pari-du-jour")({
  loader: () => getPublicDesk(),
  head: () => ({
    meta: [
      { title: "Pari du jour football : value bet et meilleure cote FR | BetGPT" },
      {
        name: "description",
        content:
          "Le pari du jour BetGPT : value bet, meilleure cote France, mise conseillée. Clique et parie chez Unibet, Betclic, Winamax.",
      },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/pari-du-jour` }],
  }),
  component: PariDuJour,
});

function PariDuJour() {
  const data = Route.useLoaderData();
  const bets = data.predictions
    .map((p) => ({ p, m: matchPick(p.markets) }))
    .filter((x) => (x.m.decision === "BET" || x.m.premium) && x.m.bestOdds >= MIN_BET_ODDS)
    .sort((a, b) => Number(b.m.premium) - Number(a.m.premium) || b.m.stakePct - a.m.stakePct)
    .slice(0, 8);
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
                name: "Quel est le pari du jour ?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: data.dailyBest
                    ? `Le pari du jour est ${data.dailyBest.market.label} sur ${data.dailyBest.prediction.home.name} – ${data.dailyBest.prediction.away.name}, cote ${data.dailyBest.market.bestOdds}.`
                    : "Pas de mise nette aujourd'hui.",
                },
              },
              {
                "@type": "Question",
                name: "Où parier avec la meilleure cote ?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Sur BetGPT on compare les books accessibles en France et on ouvre le ticket chez celui qui affiche la cote la plus haute.",
                },
              },
            ],
          }),
        }}
      />
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Pari du jour : value bet et meilleure cote</h1>
        <p className="seo-answer mt-2 max-w-3xl text-sm text-paper">
          Le ticket du jour, la mise, la cote FR, le filet 50 %. Joueurs confirmés : on ne force rien. 18+.
        </p>
      </header>
      <CoconMesh
        crumbs={[
          { name: "BetGPT", href: "/" },
          { name: "Pari du jour", href: "/pari-du-jour" },
        ]}
        parent={{ href: "/opportunities", anchor: "Toutes les opportunités", rel: "parent" }}
        sisters={COCON_MERES.map((m) => ({ href: m.path, anchor: m.title, rel: "sister" as const }))}
        children={[
          { href: "/meilleures-cotes", anchor: "Meilleures cotes du jour", rel: "child" },
          { href: "/pari-en-direct", anchor: "Paris en direct", rel: "child" },
          { href: "/calculateur-mise", anchor: "Calculateur de mise", rel: "child" },
        ]}
      />
      {data.dailyBest ? (
        <DailyBest prediction={data.dailyBest.prediction} market={data.dailyBest.market} />
      ) : (
        <p className="text-mist">Rien d'assez net aujourd'hui.</p>
      )}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Tickets à jouer maintenant</h2>
        <ul className="space-y-3">
          {bets.map(({ p, m }) => (
            <li key={`${p.matchId}-${m.market}`} className="rounded-lg border border-line bg-surface p-4">
              <Link to="/match/$matchId" params={{ matchId: p.matchId }} className="font-semibold hover:text-sage">
                {p.home.name} – {p.away.name}
              </Link>
              <p className="mt-1 text-sm text-paper">
                {m.label} · {fmtOdds(m.bestOdds)} chez {m.bestBook.replace(/\s·\s.*$/, "")} · edge {fmtPct(m.edge)}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <PrimaryParier
                  links={p.bookLinks}
                  matchId={p.matchId}
                  book={m.bestBook}
                  odds={m.bestOdds}
                  pick={m.label}
                />
                <BookLinks links={p.bookLinks} matchId={p.matchId} />
              </div>
              {m.cover ? <div className="mt-2"><CoverBet cover={m.cover} compact matchId={p.matchId} /></div> : null}
            </li>
          ))}
        </ul>
      </section>
      <p className="text-xs text-muted">Jeu responsable. 18+. Les cotes bougent ; vérifie avant de valider.</p>
    </article>
  );
}
