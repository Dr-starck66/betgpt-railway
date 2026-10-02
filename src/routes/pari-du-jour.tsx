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
      { title: "Pari du jour football : pronostic 1N2, cote et value | BetGPT" },
      {
        name: "description",
        content:
          "Pari du jour football BetGPT : sélection 1N2, probabilité modèle, meilleure cote disponible et edge. Aucun pari n’est forcé ; historique consultable.",
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
                name: "Quel est le pari du jour football ?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: data.dailyBest
                    ? `Le pari du jour est ${data.dailyBest.market.label} sur ${data.dailyBest.prediction.home.name} – ${data.dailyBest.prediction.away.name}, cote ${data.dailyBest.market.bestOdds}.`
                    : "Pas de mise nette aujourd'hui.",
                },
              },
              {
                "@type": "Question",
                name: "Comment BetGPT choisit-il le pari du jour ?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Le pari principal suit le marché 1N2 canonique lorsque les critères historiques sont réunis. La probabilité modèle, la cote et l’edge sont affichés séparément.",
                },
              },
              {
                "@type": "Question",
                name: "Que se passe-t-il si aucun pari n’est assez solide ?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "BetGPT ne force pas de ticket. Si les seuils ne sont pas réunis, la page indique qu’aucune mise nette n’est disponible.",
                },
              },
            ],
          }),
        }}
      />
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Pari du jour football : pronostic 1N2 et meilleure cote</h1>
        <p className="seo-answer mt-2 max-w-3xl text-sm text-paper">
          Le choix 1N2 le mieux classé par les gates BetGPT, avec probabilité modèle, cote, edge et historique vérifiable. Si aucun signal ne franchit les seuils, aucun pari n’est forcé. 18+.
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
      <section className="surface-card space-y-3 p-5 text-sm leading-relaxed text-mist sm:p-6">
        <h2 className="text-base font-semibold text-paper">Pourquoi ce pari plutôt qu’un autre ?</h2>
        <p>
          Le pari principal de BetGPT reste le <strong>1N2</strong>. La sélection doit rester dans la fenêtre canonique de cotes
          <strong> 1,80 à 3,00</strong> et franchir les gates historiques du moteur avant d’être présentée comme une mise.
        </p>
        <p>
          La probabilité modèle et la cote du bookmaker restent deux informations distinctes : l’edge mesure leur écart.
          Un score exact éventuel sert uniquement de couverture séparée et ne remplace pas le pronostic principal.
        </p>
        <p>
          Le résultat est ensuite conservé dans le <Link to="/ledger" className="underline">bilan public</Link>.
          Les règles sont documentées dans la <Link to="/methodology" className="underline">méthodologie</Link>.
        </p>
      </section>
      <p className="text-xs text-muted">Jeu responsable. 18+. Les cotes bougent ; vérifie avant de valider.</p>
    </article>
  );
}
