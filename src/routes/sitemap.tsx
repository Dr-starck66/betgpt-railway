import { createFileRoute } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/programmatic";
import { loadSitemapUrls } from "@/lib/sitemap-urls";
import { createServerFn } from "@tanstack/react-start";

const loadMap = createServerFn({ method: "GET" }).handler(() => loadSitemapUrls());

export const Route = createFileRoute("/sitemap")({
  loader: () => loadMap(),
  head: () => ({
    meta: [
      { title: "Plan du site BetGPT | betgpt.live" },
      { name: "description", content: "Toutes les pages BetGPT : scores, pronos, classements, calendriers, matchs." },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/sitemap` }],
  }),
  component: SitemapPage,
});

function SitemapPage() {
  const urls = Route.useLoaderData();
  const groups = new Map<string, typeof urls>();
  for (const u of urls) {
    const g = groups.get(u.group) ?? [];
    g.push(u);
    groups.set(u.group, g);
  }
  return (
    <article className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Plan du site</h1>
        <p className="seo-answer mt-2 text-sm text-paper">
          BetGPT — https://betgpt.live. {urls.length} URLs.{" "}
          <a href="/sitemap.xml" className="text-sage">
            sitemap.xml
          </a>
          {" · "}
          <a href="/sitemap-images.xml" className="text-sage">
            sitemap-images.xml
          </a>
          {" · "}
          <a href="/sitemap.html" className="text-sage">
            sitemap.html
          </a>
        </p>
      </header>
      {[...groups.entries()].map(([name, list]) => (
        <section key={name}>
          <h2 className="text-lg font-semibold">{name}</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {list.map((u) => (
              <li key={u.loc}>
                <a href={u.path} className="text-sage hover:underline">
                  {u.title}
                </a>
                <span className="ml-2 text-xs text-muted">{u.path}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </article>
  );
}
