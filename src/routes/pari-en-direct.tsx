import { createFileRoute, Link } from "@tanstack/react-router";
import { TeamLine } from "@/components/crest";
import { CoconMesh } from "@/components/cocon-mesh";
import { LiveScore } from "@/components/live-score";
import { LiveSuperCard } from "@/components/live-super";
import { BookLinks } from "@/components/book-links";
import { getPublicDesk } from "@/lib/desk.functions";
import { COCON_MERES } from "@/lib/cocon";
import { SITE_URL } from "@/lib/programmatic";
import { useLiveRefresh } from "@/lib/live-refresh";

const TITLE = "Pari en direct football : scores live, analyse et gestion du risque | BetGPT";
const DESCRIPTION =
  "Suivez les matchs de football en direct, les scores live et les opportunités recalculées par BetGPT. Méthode, limites et gestion du risque incluses.";

export const Route = createFileRoute("/pari-en-direct")({
  loader: () => getPublicDesk(),
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { name: "robots", content: "index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/pari-en-direct` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/pari-en-direct` }],
  }),
  component: LiveBets,
});

function LiveBets() {
  const data = Route.useLoaderData();
  const live = data.matches.filter((m) => m.status === "live");
  useLiveRefresh(live.length > 0);
  const byId = new Map(data.predictions.map((p) => [p.matchId, p]));

  const faq = [
    {
      q: "Comment BetGPT met-il à jour les paris en direct ?",
      a: "Les informations live sont réévaluées lorsque des données de match sont disponibles. Le score et l'état du match peuvent modifier l'analyse et la pertinence d'une opportunité.",
    },
    {
      q: "Pourquoi une opportunité peut-elle disparaître pendant un match ?",
      a: "Parce qu'une cote ou un contexte live peut évoluer très vite. Une value détectée à un instant donné peut ne plus exister quelques minutes plus tard.",
    },
    {
      q: "Faut-il parier lorsqu'aucun signal live n'est affiché ?",
      a: "Non. L'absence de signal peut simplement signifier qu'aucune opportunité ne franchit les critères du moment.",
    },
    {
      q: "Les paris en direct garantissent-ils un meilleur rendement ?",
      a: "Non. Le direct ajoute de la vitesse et de l'incertitude. Il peut aussi augmenter le risque de décision impulsive.",
    },
  ];

  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Pari en direct football BetGPT",
      url: `${SITE_URL}/pari-en-direct`,
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
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-sage">Football live · analyse dynamique</p>
        <h1 className="text-3xl font-semibold tracking-tight">Pari en direct football</h1>
        <p className="seo-answer max-w-3xl text-sm leading-6 text-paper">
          {live.length
            ? `${live.length} match${live.length > 1 ? "s" : ""} en cours. Les scores live et les opportunités BetGPT sont recalculés à partir de l'état actuel du match.`
            : "Aucun match suivi n'est actuellement en direct. La page reste utile pour préparer ta lecture live, comprendre les signaux et éviter les décisions prises dans l'urgence."}
        </p>
      </header>

      <CoconMesh
        crumbs={[
          { name: "BetGPT", href: "/" },
          { name: "Pari en direct", href: "/pari-en-direct" },
        ]}
        parent={{ href: "/pari-du-jour", anchor: "Pari du jour", rel: "parent" }}
        sisters={COCON_MERES.map((m) => ({ href: m.path, anchor: m.title, rel: "sister" as const }))}
        children={live.slice(0, 8).map((m) => ({
          href: `/match/${m.slug ?? m.id}`,
          anchor: `Analyse live ${m.home.name} – ${m.away.name}`,
          rel: "child" as const,
        }))}
      />

      <section aria-labelledby="live-now" className="space-y-4">
        <div>
          <h2 id="live-now" className="text-xl font-semibold">Matchs et opportunités en direct</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-mist">
            Les cartes ci-dessous apparaissent uniquement pour les rencontres réellement marquées comme live dans les données BetGPT.
          </p>
        </div>

        {live.length === 0 ? (
          <div className="rounded-xl border border-line bg-surface p-5">
            <h3 className="font-medium">Aucun match live pour le moment</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-mist">
              Tu peux consulter les rencontres à venir, les scores en direct lorsqu'ils démarrent, ou les résultats déjà terminés.
            </p>
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <Link to="/pari-du-jour" className="text-sage hover:underline">
                Pari du jour
              </Link>
              <Link to="/scores-en-direct" className="text-sage hover:underline">
                Scores en direct
              </Link>
              <Link to="/resultats-football" className="text-sage hover:underline">
                Résultats football
              </Link>
            </div>
          </div>
        ) : (
          <ul className="space-y-4">
            {live.map((m) => {
              const p = byId.get(m.id);
              return (
                <li key={m.id} className="space-y-3 rounded-xl border border-line bg-surface p-4">
                  <div className="flex items-center justify-between gap-3">
                    <Link to="/match/$matchId" params={{ matchId: m.slug ?? m.id }} className="min-w-0 hover:text-sage">
                      <TeamLine home={m.home} away={m.away} size={32} names="full" competition={m.competition} />
                    </Link>
                    <LiveScore match={m} size="sm" />
                  </div>
                  {p?.liveSuper ? (
                    <LiveSuperCard bet={p.liveSuper} />
                  ) : (
                    <p className="text-sm text-mist">Analyse live en cours : aucun signal suffisamment fort n'est affiché.</p>
                  )}
                  {p ? <BookLinks links={p.bookLinks} matchId={m.id} /> : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="live-method" className="space-y-3">
        <h2 id="live-method" className="text-xl font-semibold">Comment lire un pari en direct sans courir après le score</h2>
        <p className="max-w-3xl text-sm leading-6 text-paper">
          Le direct change vite : score, minute de jeu et évolution des cotes peuvent transformer une opportunité en mauvais pari.
          BetGPT sépare donc l'information live du pari pré-match et ne considère pas qu'un mouvement de cote suffit à lui seul pour miser.
        </p>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-line bg-surface p-4">
            <h3 className="font-medium">1. Contexte du match</h3>
            <p className="mt-2 text-sm leading-6 text-mist">
              Vérifier le score, l'avancement de la rencontre et l'état du marché avant toute décision.
            </p>
          </div>
          <div className="rounded-xl border border-line bg-surface p-4">
            <h3 className="font-medium">2. Probabilité contre cote</h3>
            <p className="mt-2 text-sm leading-6 text-mist">
              Une cote attractive n'est intéressante que si la probabilité estimée reste supérieure à sa probabilité implicite.
            </p>
          </div>
          <div className="rounded-xl border border-line bg-surface p-4">
            <h3 className="font-medium">3. Taille de mise</h3>
            <p className="mt-2 text-sm leading-6 text-mist">
              Le direct ne justifie pas une mise plus grosse. Utilise un cadre de bankroll et un plafond de risque.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="live-risk" className="space-y-3">
        <h2 id="live-risk" className="text-xl font-semibold">Le risque spécifique du pari live</h2>
        <p className="max-w-3xl text-sm leading-6 text-paper">
          Les décisions en direct sont plus exposées à l'urgence, au biais de récence et à la tentation de récupérer une perte.
          Une opportunité qui n'est plus affichée ne doit pas être poursuivie manuellement simplement parce qu'elle était présente quelques minutes auparavant.
        </p>
        <p className="max-w-3xl text-sm text-mist">
          Pour cadrer la mise, consulte le{" "}
          <Link to="/calculateur-mise" className="text-sage hover:underline">
            calculateur Kelly
          </Link>
          . Pour comprendre les critères du modèle, consulte la{" "}
          <Link to="/methodology" className="text-sage hover:underline">
            méthodologie
          </Link>
          {" "}et la page{" "}
          <Link to="/jeu-responsable" className="text-sage hover:underline">
            jeu responsable
          </Link>
          .
        </p>
      </section>

      <section aria-labelledby="faq-live" className="space-y-3">
        <h2 id="faq-live" className="text-xl font-semibold">Questions fréquentes sur les paris en direct</h2>
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
        18+ · Les paris sportifs comportent un risque de perte. Aucun signal live ne garantit un résultat.
      </p>
    </article>
  );
}
