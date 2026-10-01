import { Link, createFileRoute } from "@tanstack/react-router";
import { getPublicDesk } from "@/lib/desk.functions";
import { SITE_URL } from "@/lib/programmatic";
import { AstraSidewings } from "@/components/astra-sidewings";
import { ld } from "@/lib/ld";

const URL = `${SITE_URL}/rapports/precision`;
const TITLE = "Précision des pronostics football : taux de réussite, ROI et Brier | BetGPT";
const DESCRIPTION =
  "Rapport public de précision BetGPT : taux de réussite, ROI, score de Brier, taille d’échantillon et historique des pronostics enregistrés avant le coup d’envoi.";

const FAQ = [
  {
    q: "Quel est le taux de réussite des pronostics BetGPT ?",
    a: "Le taux affiché sur cette page est calculé uniquement à partir des pronostics éligibles et réglés du registre public. S’il n’existe pas encore assez de lignes exploitables, BetGPT affiche « non calculé » au lieu d’inventer un pourcentage.",
  },
  {
    q: "Comment le ROI des pronostics est-il calculé ?",
    a: "Le ROI nécessite des mises et des cotes réellement enregistrées. Lorsqu’une cote manque, la ligne ne doit pas être transformée en rendement fictif. Le détail des lignes et des règlements reste consultable dans le registre public.",
  },
  {
    q: "À quoi sert le score de Brier ?",
    a: "Le score de Brier mesure l’écart entre une probabilité annoncée et le résultat observé. Plus il est faible, meilleure est la calibration probabiliste sur l’échantillon étudié. Il ne mesure pas à lui seul la rentabilité d’une stratégie de pari.",
  },
  {
    q: "Peut-on juger la fiabilité d’un pronostic sur quelques matchs ?",
    a: "Non. Une petite série peut être dominée par la variance. Le taux de réussite, le ROI et la calibration doivent toujours être lus avec la taille de l’échantillon, la période, les marchés suivis et la méthode de sélection.",
  },
];

export const Route = createFileRoute("/rapports/precision")({
  loader: () => getPublicDesk(),
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { name: "robots", content: "index, follow, max-snippet:-1, max-image-preview:large" },
      { name: "googlebot", content: "index, follow, max-snippet:-1, max-image-preview:large" },
      { property: "og:locale", content: "fr_FR" },
      { property: "og:site_name", content: "BetGPT" },
      { property: "og:type", content: "website" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [
      { rel: "canonical", href: URL },
      { rel: "alternate", hrefLang: "fr", href: URL },
      { rel: "alternate", hrefLang: "x-default", href: URL },
    ],
  }),
  component: Page,
});

function cell(v: number | null | undefined, digits = 1): string {
  if (v == null || Number.isNaN(v)) return "non calculé";
  return v.toFixed(digits).replace(".", ",");
}

function pct(v: number | null | undefined): string {
  return v == null || Number.isNaN(v) ? "non calculé" : `${(v * 100).toFixed(1).replace(".", ",")} %`;
}

function Page() {
  const desk = Route.useLoaderData();
  const e = desk.evidence;
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${URL}#webpage`,
        url: URL,
        name: TITLE,
        description: DESCRIPTION,
        inLanguage: "fr-FR",
        isPartOf: { "@id": `${SITE_URL}/#website` },
        about: [
          { "@type": "Thing", name: "précision des pronostics football" },
          { "@type": "Thing", name: "taux de réussite" },
          { "@type": "Thing", name: "retour sur investissement (ROI)" },
          { "@type": "Thing", name: "score de Brier" },
        ],
        mainEntity: { "@id": `${URL}#faq` },
      },
      {
        "@type": "FAQPage",
        "@id": `${URL}#faq`,
        mainEntity: FAQ.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Accueil", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Bilan public", item: `${SITE_URL}/ledger` },
          { "@type": "ListItem", position: 3, name: "Rapport de précision", item: URL },
        ],
      },
    ],
  };

  return (
    <AstraSidewings
      ariaLabel="Navigation contextuelle du rapport de précision"
      left={{
        eyebrow: "Preuves",
        title: "Du chiffre au registre",
        intro: "Relie les métriques synthétiques aux pages où BetGPT expose les décisions, les données et leur méthode.",
        links: [
          { href: "/ledger", label: "Bilan détaillé", description: "Voir les paris, règlements et résultats ligne par ligne." },
          { href: "/prediction-history", label: "Historique des prédictions", description: "Comprendre comment les décisions sont conservées." },
          { href: "/methodology", label: "Méthodologie", description: "Définition du modèle, des métriques, limites et hypothèses." },
          { href: "/data-sources", label: "Sources des données", description: "Origine et couverture des scores, calendriers et cotes." },
        ],
      }}
      right={{
        eyebrow: "Repères",
        title: "Lire la précision correctement",
        intro: "Une performance n’a de sens qu’avec son échantillon, sa période, ses marchés, ses prix réellement observés et ses limites.",
        stats: [
          { label: "Réglés", value: String(e.settled), detail: "Pronostics disposant d’un règlement exploitable." },
          { label: "Gagnés / perdus", value: `${e.wins} / ${e.losses}`, detail: "Résultats observés dans l’échantillon affiché." },
          { label: "Échantillon", value: e.sampleLabel, detail: "Contexte utilisé par ce rapport public." },
        ],
        links: [
          { href: "/evidence.json", label: "Evidence JSON", description: "Export brut machine-readable." },
          { href: "/evidence.csv", label: "Evidence CSV", description: "Export tabulaire du bilan." },
          { href: "/jeu-responsable", label: "Jeu responsable", description: "Interpréter les performances sans promesse de gain." },
        ],
      }}
    >
      <article className="max-w-3xl space-y-8">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld(schema) }} />

        <header className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sage">Bilan public · preuves vérifiables</p>
          <h1 className="text-3xl font-semibold tracking-tight text-paper">
            Précision des pronostics football BetGPT : taux de réussite, ROI et score de Brier
          </h1>
          <p className="seo-answer text-base leading-relaxed text-mist">
            Ce rapport mesure la performance des pronostics BetGPT enregistrés avant le coup d’envoi. Il sépare le
            <strong className="text-paper"> taux de réussite</strong>, le
            <strong className="text-paper"> ROI</strong> lorsqu’une cote exploitable existe, la
            <strong className="text-paper"> calibration probabiliste</strong> via le score de Brier et surtout la
            <strong className="text-paper"> taille de l’échantillon</strong>. Aucun pourcentage n’est complété à la main pour rendre le bilan plus flatteur.
          </p>
          <p className="text-sm text-muted">
            Données brutes :
            {" "}
            <a href="/evidence.json" className="text-sage underline underline-offset-2">evidence.json</a>
            {" · "}
            <a href="/evidence.csv" className="text-sage underline underline-offset-2">CSV</a>
            {" · "}
            <Link to="/ledger" className="text-sage underline underline-offset-2">registre détaillé</Link>.
          </p>
        </header>

        <section aria-labelledby="mesures" className="space-y-4">
          <h2 id="mesures" className="text-xl font-semibold text-paper">Les chiffres actuels du bilan</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <Stat label="Avant coup d’envoi" value={String(e.beforeKickoff)} />
            <Stat label="Réglés" value={String(e.settled)} />
            <Stat label="Gagnés / perdus" value={`${e.wins} / ${e.losses}`} />
            <Stat label="Taux de réussite" value={pct(e.winRate)} />
            <Stat label="ROI" value={pct(e.roi)} />
            <Stat label="Score de Brier" value={cell(e.brier, 3)} />
            <Stat label="Échantillon" value={e.sampleLabel} />
          </dl>
          {e.unavailable.length ? (
            <div className="rounded-xl border border-line bg-surface p-4">
              <p className="text-sm font-semibold text-paper">Métriques indisponibles ou incomplètes</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
                {e.unavailable.map((u) => <li key={u}>{u}</li>)}
              </ul>
            </div>
          ) : null}
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-paper">Comment lire un taux de réussite de pronostics football</h2>
          <p className="text-sm leading-relaxed text-mist">
            Le taux de réussite répond à une question simple : parmi les sélections réglées, combien ont été gagnantes ? Mais ce pourcentage ne suffit pas pour mesurer la qualité d’un moteur. Un système qui choisit presque uniquement de très gros favoris peut afficher beaucoup de gagnants tout en offrant des prix trop faibles. À l’inverse, une stratégie plus sélective peut gagner moins souvent tout en produisant un meilleur rendement si les cotes obtenues compensent correctement les pertes.
          </p>
          <p className="text-sm leading-relaxed text-mist">
            C’est pourquoi BetGPT affiche ensemble le nombre de pronostics réglés, les gains et pertes, le taux de réussite et le ROI lorsque ce dernier peut être calculé. La lecture correcte commence toujours par l’échantillon : dix résultats ne racontent pas la même chose que plusieurs centaines de décisions enregistrées selon une méthode stable.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-paper">ROI : mesurer le rendement sans réécrire les cotes après le match</h2>
          <p className="text-sm leading-relaxed text-mist">
            Le retour sur investissement compare le résultat des mises au capital engagé. Pour qu’il soit auditable, il faut connaître le marché joué, la mise et la cote disponible au moment de la décision. Une cote retrouvée après le match ne doit pas être substituée à une cote absente : cela créerait un rendement rétrospectif impossible à reproduire.
          </p>
          <p className="text-sm leading-relaxed text-mist">
            Lorsqu’une ligne du registre ne possède pas les informations nécessaires, le rapport préfère afficher « non calculé ». Le détail complet reste accessible dans le <Link to="/ledger" className="text-sage hover:underline">bilan public</Link>, tandis que la <Link to="/prediction-history" className="text-sage hover:underline">page d’historique</Link> explique les champs conservés avant et après le coup d’envoi.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-paper">Score de Brier : vérifier si les probabilités sont bien calibrées</h2>
          <p className="text-sm leading-relaxed text-mist">
            Un pronostic football n’est pas seulement une étiquette « gagnant » ou « perdant ». Lorsque le modèle annonce une probabilité, il faut aussi mesurer si les niveaux de confiance correspondent aux fréquences observées. Le score de Brier pénalise l’écart entre la probabilité annoncée et le résultat réel. Un score plus faible indique une meilleure calibration sur l’échantillon mesuré.
          </p>
          <p className="text-sm leading-relaxed text-mist">
            Cette métrique complète le taux de réussite et le ROI ; elle ne les remplace pas. Un modèle peut être relativement bien calibré mais exploiter des prix peu intéressants, ou obtenir un bon rendement sur une période courte grâce à la variance. L’interprétation doit donc rester multidimensionnelle.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-paper">Ce qui entre dans le rapport — et ce qui doit en rester exclu</h2>
          <p className="text-sm leading-relaxed text-mist">
            Le rapport public vise les décisions éligibles enregistrées avant le début du match. Les résultats connus après coup servent à régler les lignes, pas à réécrire le choix initial. Les marchés, gates et règles de sélection doivent rester cohérents pour qu’une série historique soit comparable dans le temps.
          </p>
          <p className="text-sm leading-relaxed text-mist">
            Les informations secondaires peuvent enrichir l’analyse, mais elles ne doivent pas contaminer le bilan canonique en étant ajoutées rétroactivement. Les principes de calcul sont détaillés dans la <Link to="/methodology" className="text-sage hover:underline">méthodologie BetGPT</Link> et les origines des données dans la page <Link to="/data-sources" className="text-sage hover:underline">sources de données</Link>.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-paper">Questions fréquentes sur la fiabilité des pronostics</h2>
          <div className="space-y-3">
            {FAQ.map((item) => (
              <details key={item.q} className="rounded-xl border border-line bg-surface p-4">
                <summary className="cursor-pointer font-semibold text-paper">{item.q}</summary>
                <p className="mt-3 text-sm leading-relaxed text-mist">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="text-lg font-semibold text-paper">Auditer les chiffres soi-même</h2>
          <p className="mt-2 text-sm leading-relaxed text-mist">
            Commence par le <Link to="/ledger" className="text-sage hover:underline">registre ligne par ligne</Link>, vérifie l’horodatage via l’<Link to="/prediction-history" className="text-sage hover:underline">historique des prédictions</Link>, puis confronte les règles à la <Link to="/methodology" className="text-sage hover:underline">méthodologie</Link>. Les exports <a href="/evidence.json" className="text-sage hover:underline">JSON</a> et <a href="/evidence.csv" className="text-sage hover:underline">CSV</a> permettent une lecture machine ou tabulaire.
          </p>
        </section>
      </article>
    </AstraSidewings>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 font-medium text-paper">{value}</dd>
    </div>
  );
}
