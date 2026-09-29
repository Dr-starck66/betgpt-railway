import { Link, createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { GUIDE_ALIASES, GUIDES } from "@/lib/seo/money-map";
import { SITE_URL } from "@/lib/programmatic";

export const Route = createFileRoute("/guides/$slug")({
  beforeLoad: ({ params }) => {
    const target = GUIDE_ALIASES[params.slug];
    if (target) {
      throw redirect({ to: "/guides/$slug", params: { slug: target }, statusCode: 301, replace: true });
    }
  },
  loader: ({ params }) => {
    const guide = GUIDES.find((g) => g.slug === params.slug);
    if (!guide) throw notFound();
    return guide;
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const url = `${SITE_URL}/guides/${loaderData.slug}`;
    return {
      meta: [
        { title: `${loaderData.title} | BetGPT` },
        { name: "description", content: loaderData.description },
        { name: "robots", content: "index, follow" },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  notFoundComponent: () => <p className="text-muted">Guide introuvable.</p>,
  component: Page,
});

function Page() {
  const guide = Route.useLoaderData();
  return (
    <article className="max-w-3xl space-y-4">
      <p className="text-xs text-muted">
        <Link to="/guides" className="hover:text-paper">
          Guides
        </Link>
      </p>
      <h1 className="text-2xl font-semibold">{guide.h1}</h1>
      {guide.paragraphs.map((p) => (
        <p key={p.slice(0, 24)} className="text-sm leading-relaxed text-mist">
          {p}
        </p>
      ))}
      <ul className="space-y-1 text-sm">
        {guide.links.map((l) => (
          <li key={l.href}>
            <Link to={l.href} className="text-sage hover:text-paper">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">18+. Une formule n’est pas une promesse de résultat.</p>
    </article>
  );
}
