import { Link, createFileRoute } from "@tanstack/react-router";
import { GUIDES } from "@/lib/seo/money-map";
import { SITE_URL } from "@/lib/programmatic";

export const Route = createFileRoute("/guides/")({
  head: () => ({
    meta: [
      { title: "Guides : cotes, probabilités et limites | BetGPT" },
      {
        name: "description",
        content: "Guides courts pour lire une cote, une probabilité implicite, une value et le critère de Kelly. Sans promesse de gain.",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:url", content: `${SITE_URL}/guides` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/guides` }],
  }),
  component: Page,
});

function Page() {
  return (
    <article className="space-y-4">
      <h1 className="text-2xl font-semibold">Guides</h1>
      <p className="max-w-2xl text-sm text-mist">
        Ces pages expliquent les calculs utilisés par les outils. Elles ne remplacent pas une fiche de match.
      </p>
      <ul className="space-y-3">
        {GUIDES.map((g) => (
          <li key={g.slug} className="rounded-lg border border-line p-4">
            <Link to="/guides/$slug" params={{ slug: g.slug }} className="font-medium text-paper hover:text-sage">
              {g.h1}
            </Link>
            <p className="mt-1 text-sm text-muted">{g.description}</p>
          </li>
        ))}
      </ul>
    </article>
  );
}
