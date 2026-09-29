import { createFileRoute, Link } from "@tanstack/react-router";
import { getEditorialEdition } from "@/lib/editorial.functions";
import { HUB_SECTIONS, SECTION_MIN, sectionArticles } from "@/lib/editorial/engine";
import { formatParis } from "@/lib/editorial/time";
import { isPublicArticle } from "@/lib/editorial/types";
import { SITE_URL } from "@/lib/programmatic";

export const Route = createFileRoute("/actualites/")({
  loader: () => getEditorialEdition(),
  head: () => ({
    meta: [
      { title: "Actualités football | BetGPT" },
      {
        name: "description",
        content:
          "Actualités football de BetGPT Editorial : trois publications ciblées par jour pour la France, avec sources, contexte, contrôle de qualité et remplacement automatique des sujets faibles.",
      },
      { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1" },
      { property: "og:title", content: "Actualités football | BetGPT" },
      { property: "og:url", content: `${SITE_URL}/actualites` },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "canonical", href: `${SITE_URL}/actualites` },
      { rel: "alternate", type: "application/rss+xml", href: `${SITE_URL}/actualites-rss.xml` },
    ],
  }),
  component: ActualitesPage,
});

function ActualitesPage() {
  const edition = Route.useLoaderData();
  const published = edition.articles.filter(isPublicArticle);
  const hubs = HUB_SECTIONS.filter(
    (section) => (sectionArticles(edition, section.slug)?.length ?? 0) >= SECTION_MIN,
  );
  const [featured, ...rest] = published;

  return (
    <div className="mx-auto max-w-[1280px] space-y-8">
      <section className="hero-panel p-6 sm:p-8">
        <p className="eyebrow">BetGPT Editorial</p>
        <h1 className="mt-2 font-display text-3xl tracking-tight sm:text-5xl">Actualités football</h1>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-mist sm:text-lg">
          Une rédaction sélective pour la France : trois articles ciblés par jour à 08 h 00, 13 h 00 et 19 h 00 (heure de Paris), avec remplacement automatique si un sujet est trop faible.
        </p>
        <div className="mt-5 flex flex-wrap gap-2 text-sm">
          <a href="/actualites-rss.xml" className="chip-pill hover:border-sage/30 hover:text-link">
            Flux RSS
          </a>
          <Link to="/auteurs/betgpt-editorial" className="chip-pill hover:border-sage/30 hover:text-link">
            BetGPT Editorial
          </Link>
          <span className="chip-pill">{edition.parisDate} · Europe/Paris</span>
        </div>
      </section>

      {hubs.length ? (
        <ul className="flex flex-wrap gap-2 text-sm">
          {hubs.map((hub) => (
            <li key={hub.slug}>
              <Link
                to="/actualites/$slug"
                params={{ slug: hub.slug }}
                className="chip-pill hover:border-sage/30 hover:text-link"
              >
                {hub.title}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {featured ? (
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
          <Link to="/actualites/$slug" params={{ slug: featured.slug }} className="section-card overflow-hidden">
            <div className="grid h-full lg:grid-cols-[minmax(0,1.1fr)_minmax(250px,0.9fr)]">
              <div className="p-5 sm:p-7">
                <div className="flex flex-wrap gap-2">
                  <span className="chip-pill border-sage/25 bg-sage/10 text-link">{featured.category}</span>
                  <span className="chip-pill">{formatParis(featured.publishedAt)}</span>
                </div>
                <h2 className="mt-4 text-2xl font-bold leading-tight tracking-tight text-paper sm:text-[2rem]">
                  {featured.h1}
                </h2>
                <p className="mt-4 readable-prose text-[0.98rem]">{featured.lead}</p>
                <div className="mt-5 text-sm font-semibold text-link">Lire l’article →</div>
              </div>
              <div className="min-h-[230px] bg-slate-100 lg:min-h-full">
                <img
                  src={featured.image.src}
                  alt={featured.image.alt}
                  width={featured.image.width}
                  height={featured.image.height}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          </Link>

          <div className="surface-card p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-paper">Rythme de publication</h2>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-mist">
              <li>• Trois créneaux éditoriaux quotidiens : matin, midi et soirée.</li>
              <li>• Images fortes, angle clair et intérêt concret pour le public français.</li>
              <li>• Un sujet faible est remplacé par un meilleur candidat ; pas de programme générique ni de remplissage automatique.</li>
            </ul>
            <div className="mt-5 border-t border-line pt-4">
              <h3 className="text-sm font-semibold text-paper">Créneaux du jour</h3>
              <ul className="mt-3 space-y-2 text-sm text-mist">
                {edition.slots.map((slot) => (
                  <li key={slot.id}>
                    <span className="font-semibold text-paper">{slot.time}</span>
                    {" · "}
                    {slot.article ? slot.article.status : "SKIPPED"}
                    {" · "}
                    {slot.article?.h1 ?? slot.skipped?.reason ?? "aucun sujet"}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ) : null}

      {rest.length ? (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rest.map((article) => (
            <li key={article.slug}>
              <Link to="/actualites/$slug" params={{ slug: article.slug }} className="surface-card block overflow-hidden h-full">
                <img
                  src={article.image.src}
                  alt={article.image.alt}
                  width={article.image.width}
                  height={article.image.height}
                  className="aspect-[16/10] w-full object-cover"
                />
                <div className="space-y-2 p-4 sm:p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-link">
                    {article.category} · {formatParis(article.publishedAt)}
                  </p>
                  <h2 className="text-xl font-semibold leading-snug tracking-tight text-paper">{article.h1}</h2>
                  <p className="line-clamp-3 text-sm leading-relaxed text-mist">{article.lead}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : published.length ? null : (
        <div className="surface-card p-6 text-sm text-mist">Pas encore d'article publié aujourd'hui.</div>
      )}
    </div>
  );
}
