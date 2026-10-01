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

const TITLE = "Calculateur de mise Kelly football : bankroll et value bet | BetGPT";
const DESCRIPTION =
  "Calcule une mise Kelly à partir de ta bankroll, de la cote et de la probabilité estimée. Comprends la formule, le demi-Kelly, les limites et la gestion du risque.";

export const Route = createFileRoute("/calculateur-mise")({
  loader: () => getPublicDesk(),
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { name: "robots", content: "index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/calculateur-mise` },
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
  const exampleOdds = 2.1;
  const exampleProb = 0.55;
  const exampleKelly = kellyFraction(exampleProb, exampleOdds);
  const exampleStake = 500 * exampleKelly;

  const faq = [
    {
      q: "À quoi sert la formule de Kelly ?",
      a: "Elle estime la part de bankroll théoriquement optimale à engager lorsque ta probabilité estimée est supérieure à celle implicite dans la cote.",
    },
    {
      q: "Pourquoi utiliser le demi-Kelly ?",
      a: "Parce qu'une probabilité estimée reste incertaine. Le demi-Kelly réduit fortement la volatilité et l'impact d'une erreur de modèle.",
    },
    {
      q: "Que se passe-t-il s'il n'y a pas de value bet ?",
      a: "La mise Kelly tombe à zéro. Le bon résultat du calculateur peut donc être de ne pas parier.",
    },
    {
      q: "Le calculateur garantit-il un gain ?",
      a: "Non. Kelly optimise une taille de mise sous des hypothèses probabilistes, mais ne supprime ni l'incertitude, ni les séries de pertes, ni le risque de ruine lié à de mauvaises estimations.",
    },
  ];

  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "Calculateur de mise Kelly BetGPT",
      url: `${SITE_URL}/calculateur-mise`,
      applicationCategory: "FinanceApplication",
      operatingSystem: "Web",
      description: DESCRIPTION,
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.a,
        },
      })),
    },
  ];

  return (
    <article className="space-y-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <header className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-sage">Gestion de bankroll · football</p>
        <h1 className="text-3xl font-semibold tracking-tight">Calculateur de mise Kelly</h1>
        <p className="seo-answer max-w-3xl text-sm leading-6 text-paper">
          Entre ta bankroll puis compare les mises proposées pour les opportunités détectées par BetGPT. La formule de Kelly
          ajuste la taille de mise à la cote et à la probabilité estimée au lieu d'appliquer un pourcentage fixe à tous les paris.
        </p>
        <p className="max-w-3xl text-sm text-mist">
          Par défaut, BetGPT plafonne l'exposition à 8 % du roll. Si tu veux réduire la volatilité, utilise plutôt une fraction de
          Kelly — par exemple le demi-Kelly.
        </p>
      </header>

      <CoconMesh
        crumbs={[
          { name: "BetGPT", href: "/" },
          { name: "Calculateur de mise", href: "/calculateur-mise" },
        ]}
        parent={{ href: "/pari-du-jour", anchor: "Pari du jour", rel: "parent" }}
        sisters={COCON_MERES.map((m) => ({ href: m.path, anchor: m.title, rel: "sister" as const }))}
        children={[
          { href: "/opportunities", anchor: "Opportunités", rel: "child" },
          { href: "/methodology", anchor: "Méthodologie BetGPT", rel: "child" },
        ]}
      />

      <section aria-labelledby="kelly-calculator" className="space-y-4">
        <div>
          <h2 id="kelly-calculator" className="text-xl font-semibold">Calculer la mise à partir de ta bankroll</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-mist">
            Modifie le montant de bankroll : les mises sont recalculées immédiatement à partir des cotes et probabilités du modèle.
          </p>
        </div>

        <label className="block max-w-xs text-sm">
          Bankroll (€)
          <input
            value={bank}
            inputMode="decimal"
            onChange={(e) => setBank(e.target.value)}
            className="mt-1 block w-full rounded-md border border-line bg-surface px-3 py-2"
            aria-describedby="bankroll-help"
          />
        </label>
        <p id="bankroll-help" className="text-xs text-muted">
          Exemple : 500 signifie une bankroll totale de 500 €.
        </p>

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
      </section>

      <section aria-labelledby="kelly-formula" className="space-y-3">
        <h2 id="kelly-formula" className="text-xl font-semibold">Comment fonctionne la formule de Kelly ?</h2>
        <p className="max-w-3xl text-sm leading-6 text-paper">
          Kelly compare la cote proposée à ta probabilité estimée. Si la cote n'offre pas d'avantage mathématique, la fraction
          calculée est nulle. Si un avantage existe, la mise augmente avec cet écart — tout en restant plafonnée côté BetGPT.
        </p>
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-sm font-medium">Exemple concret</p>
          <p className="mt-2 text-sm leading-6 text-mist">
            Avec une bankroll de 500 €, une cote de {exampleOdds.toFixed(2)} et une probabilité estimée à {fmtPct(exampleProb)},
            Kelly donne environ {fmtPct(exampleKelly)}, soit une mise théorique proche de {exampleStake.toFixed(1)} € avant
            application éventuelle d'une fraction de Kelly et des plafonds de risque.
          </p>
        </div>
      </section>

      <section aria-labelledby="fractional-kelly" className="space-y-3">
        <h2 id="fractional-kelly" className="text-xl font-semibold">Kelly, demi-Kelly ou mise fixe ?</h2>
        <p className="max-w-3xl text-sm leading-6 text-paper">
          Le Kelly intégral maximise la croissance théorique à long terme lorsque les probabilités sont correctement estimées.
          En pratique, le demi-Kelly ou le quart-Kelly sont souvent plus prudents : ils réduisent la taille des mises et les
          drawdowns quand le modèle se trompe.
        </p>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-line bg-surface p-4">
            <h3 className="font-medium">Kelly intégral</h3>
            <p className="mt-2 text-sm text-mist">Exposition maximale au signal. Volatilité plus forte.</p>
          </div>
          <div className="rounded-xl border border-line bg-surface p-4">
            <h3 className="font-medium">Demi-Kelly</h3>
            <p className="mt-2 text-sm text-mist">50 % de la mise Kelly. Compromis plus prudent.</p>
          </div>
          <div className="rounded-xl border border-line bg-surface p-4">
            <h3 className="font-medium">Mise fixe</h3>
            <p className="mt-2 text-sm text-mist">Simple, mais ne tient pas compte de la force du signal ni de la cote.</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="risk" className="space-y-3">
        <h2 id="risk" className="text-xl font-semibold">Ce que le calculateur ne doit pas faire oublier</h2>
        <p className="max-w-3xl text-sm leading-6 text-paper">
          Une mise optimale sur le papier reste dépendante de la qualité de la probabilité. Une mauvaise estimation peut rendre
          une value bet apparente inexistante. Garde une bankroll dédiée, évite de poursuivre les pertes et considère toujours
          zéro euro comme une décision valide.
        </p>
        <p className="text-sm text-mist">
          Consulte aussi notre{" "}
          <Link to="/methodology" className="text-sage hover:underline">
            méthodologie
          </Link>
          , l'{" "}
          <Link to="/prediction-history" className="text-sage hover:underline">
            historique des prédictions
          </Link>
          {" "}et la page{" "}
          <Link to="/jeu-responsable" className="text-sage hover:underline">
            jeu responsable
          </Link>
          .
        </p>
      </section>

      <section aria-labelledby="faq-kelly" className="space-y-3">
        <h2 id="faq-kelly" className="text-xl font-semibold">Questions fréquentes sur le calculateur Kelly</h2>
        <div className="space-y-3">
          {faq.map((item) => (
            <div key={item.q} className="rounded-xl border border-line bg-surface p-4">
              <h3 className="font-medium">{item.q}</h3>
              <p className="mt-2 text-sm leading-6 text-mist">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      <p className="border-t border-line pt-4 text-xs text-muted">
        18+ · Aucun calculateur de mise ne garantit un gain. Les paris sportifs impliquent un risque de perte.
      </p>
    </article>
  );
}
