import { Link, createFileRoute } from "@tanstack/react-router";
import { GUIDES } from "@/lib/seo/money-map";
import { SITE_URL } from "@/lib/programmatic";
import { ld } from "@/lib/ld";

const URL = `${SITE_URL}/guides`;
const TITLE = "Guides paris football : cotes, probabilités, value et Kelly | BetGPT";
const DESCRIPTION =
  "Guides BetGPT pour comprendre cotes, probabilités implicites, value bet, Kelly et limites des modèles avant de lire un pronostic football.";

export const Route = createFileRoute("/guides/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { name: "robots", content: "index, follow, max-snippet:-1, max-image-preview:large" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: URL },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
  component: Page,
});

function Page() {
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${URL}#collection`,
        url: URL,
        name: TITLE,
        description: DESCRIPTION,
        inLanguage: "fr-FR",
        isPartOf: { "@id": `${SITE_URL}/#website` },
        mainEntity: { "@id": `${URL}#items` },
      },
      {
        "@type": "ItemList",
        "@id": `${URL}#items`,
        itemListElement: GUIDES.map((g, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: g.h1,
          url: `${SITE_URL}/guides/${g.slug}`,
        })),
      },
    ],
  };

  return (
    <article className="space-y-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld(schema) }} />
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sage">Comprendre avant de parier</p>
        <h1 className="text-3xl font-semibold tracking-tight">Guides paris football : cotes, probabilités et value</h1>
        <p className="seo-answer max-w-3xl text-base leading-relaxed text-mist">
          Cette bibliothèque explique les notions utilisées sur BetGPT : probabilité implicite d’une cote, espérance,
          value bet, critère de Kelly, calibration et limites d’un modèle. L’objectif est de pouvoir lire un pronostic
          football sans confondre estimation, prix de marché et certitude.
        </p>
      </header>

      <ul className="grid gap-3 sm:grid-cols-2">
        {GUIDES.map((g) => (
          <li key={g.slug} className="rounded-xl border border-line bg-surface p-4">
            <Link to="/guides/$slug" params={{ slug: g.slug }} className="font-semibold text-paper hover:text-sage">
              {g.h1}
            </Link>
            <p className="mt-2 text-sm leading-relaxed text-muted">{g.description}</p>
          </li>
        ))}
      </ul>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold text-paper">Aller plus loin</h2>
        <p className="mt-2 text-sm leading-relaxed text-mist">
          Pour relier les concepts aux données réellement publiées, consulte la
          {" "}<Link to="/methodology" className="text-sage hover:underline">méthodologie BetGPT</Link>,
          le <Link to="/rapports/precision" className="text-sage hover:underline">rapport de précision</Link>,
          le <Link to="/comparer-cotes" className="text-sage hover:underline">comparateur de cotes</Link> et les
          règles de <Link to="/jeu-responsable" className="text-sage hover:underline">jeu responsable</Link>.
        </p>
      </section>
    </article>
  );
}
