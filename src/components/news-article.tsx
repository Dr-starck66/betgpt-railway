import { Link } from "@tanstack/react-router";
import { orderedContextualSourceIds } from "@/lib/editorial/authority-citations";
import { newsArticleLd, breadcrumbLd } from "@/lib/editorial/schema";
import { formatParis } from "@/lib/editorial/time";
import type { EditorialArticle, EditorialSource } from "@/lib/editorial/types";
import { ld } from "@/lib/ld";

function SourceCitations({
  sourceIds,
  sources,
}: {
  sourceIds?: string[];
  sources: EditorialSource[];
}) {
  const passageSources = orderedContextualSourceIds(sourceIds, sources)
    .map((sourceId) => sources.find((source) => source.id === sourceId))
    .filter((source): source is EditorialSource => Boolean(source));

  if (!passageSources.length) return null;

  return (
    <p className="border-t border-line pt-3 text-xs leading-relaxed text-muted">
      <span className="font-semibold text-mist">Sources de ce passage : </span>
      {passageSources.map((source, index) => (
        <span key={source.id}>
          {index ? " · " : ""}
          {source.url ? (
            <a href={source.url} className="font-semibold text-link hover:underline">
              {source.label}
            </a>
          ) : (
            <span className="font-semibold text-paper">{source.label}</span>
          )}
        </span>
      ))}
    </p>
  );
}

export function NewsArticleView({ article }: { article: EditorialArticle }) {
  const published = formatParis(article.publishedAt);
  const modified =
    article.modifiedAt && article.publishedAt && article.modifiedAt > article.publishedAt
      ? formatParis(article.modifiedAt)
      : null;

  return (
    <article className="mx-auto max-w-[1240px] space-y-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld(newsArticleLd(article)) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld(breadcrumbLd(article)) }} />

      <div className="hero-panel overflow-hidden p-6 sm:p-8 lg:p-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-2">
              <span className="chip-pill border-sage/25 bg-sage/10 text-link">{article.category}</span>
              <span className="chip-pill">{article.competition}</span>
            </div>
            <h1 className="mt-5 font-display text-3xl tracking-tight sm:text-4xl lg:text-5xl">{article.h1}</h1>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-mist sm:text-lg">{article.lead}</p>

            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
              <span>Publié le {published} (Europe/Paris)</span>
              {modified ? <span>Mis à jour le {modified}</span> : null}
              <span>
                Par{" "}
                <Link to="/auteurs/betgpt-editorial" className="font-semibold text-link hover:underline">
                  BetGPT Editorial
                </Link>
              </span>
            </div>
          </div>

          <aside className="glass-panel p-5">
            <p className="text-sm font-semibold text-paper">Repères</p>
            <dl className="mt-4 space-y-3 text-sm leading-relaxed text-mist">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Compétition</dt>
                <dd className="mt-1 text-paper">{article.competition}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Sources affichées</dt>
                <dd className="mt-1 text-paper">{article.sources.length}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Publication</dt>
                <dd className="mt-1 text-paper">{published}</dd>
              </div>
            </dl>
          </aside>
        </div>
      </div>

      <figure className="section-card overflow-hidden">
        <img
          src={article.image.src}
          alt={article.image.alt}
          width={article.image.width}
          height={article.image.height}
          className="aspect-video w-full object-cover"
        />
        <figcaption className="border-t border-line px-4 py-3 text-xs text-muted sm:px-6">
          {article.image.credit}
        </figcaption>
      </figure>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <div className="min-w-0 space-y-6">
          <div className="surface-card p-5 sm:p-6">
            <p className="readable-prose text-paper">{article.lead}</p>
          </div>

          {article.paragraphs.map((part) => (
            <section key={part.h2} className="surface-card space-y-4 p-5 sm:p-7">
              <h2 className="text-2xl font-semibold tracking-tight">{part.h2}</h2>
              <p className="readable-prose">{part.body}</p>
              <SourceCitations sourceIds={part.sourceIds} sources={article.sources} />

              {part.subsections?.length ? (
                <div className="space-y-6 border-t border-line pt-5">
                  {part.subsections.map((subsection) => (
                    <section key={subsection.h3} className="space-y-3">
                      <h3 className="text-xl font-semibold tracking-tight text-paper">{subsection.h3}</h3>
                      <p className="readable-prose">{subsection.body}</p>
                      <SourceCitations sourceIds={subsection.sourceIds} sources={article.sources} />

                      {subsection.subsections?.length ? (
                        <div className="space-y-4 border-l border-line pl-4 sm:pl-5">
                          {subsection.subsections.map((detail) => (
                            <section key={detail.h4} className="space-y-2">
                              <h4 className="text-base font-semibold text-paper">{detail.h4}</h4>
                              <p className="readable-prose">{detail.body}</p>
                              <SourceCitations sourceIds={detail.sourceIds} sources={article.sources} />
                            </section>
                          ))}
                        </div>
                      ) : null}
                    </section>
                  ))}
                </div>
              ) : null}
            </section>
          ))}

          {article.corrections.length ? (
            <section className="surface-card p-5 text-sm text-mist sm:p-6">
              <h2 className="text-lg font-semibold text-paper">Corrections</h2>
              <ul className="mt-3 space-y-2">
                {article.corrections.map((row) => (
                  <li key={row.at}>
                    {formatParis(row.at)} — {row.note}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-28">
          <section className="surface-card p-5">
            <h2 className="text-base font-semibold text-paper">Sources</h2>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-mist">
              {article.sources.map((source) => (
                <li key={source.id}>
                  {source.url ? (
                    <a href={source.url} className="font-semibold text-link hover:underline">
                      {source.label}
                    </a>
                  ) : (
                    <span className="font-semibold text-paper">{source.label}</span>
                  )}
                  <div>{source.status}</div>
                  <div>{source.note}</div>
                </li>
              ))}
            </ul>
          </section>

          <section className="surface-card p-5">
            <h2 className="text-base font-semibold text-paper">À suivre sur BetGPT</h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {article.links.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="chip-pill hover:border-sage/30 hover:text-link">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>

          {article.related.length ? (
            <section className="surface-card p-5">
              <h2 className="text-base font-semibold text-paper">À lire aussi</h2>
              <ul className="mt-4 space-y-4">
                {article.related.map((item) => {
                  const visual = item.image ?? article.image;
                  return (
                    <li key={item.href}>
                      <a
                        href={item.href}
                        className="group block overflow-hidden rounded-2xl border border-line bg-panel/35 transition hover:border-sage/30"
                      >
                        <img
                          src={visual.src}
                          alt={visual.alt}
                          width={visual.width}
                          height={visual.height}
                          loading="lazy"
                          decoding="async"
                          sizes="(min-width: 1024px) 268px, 100vw"
                          className="aspect-video w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                        />
                        <div className="p-3.5">
                          <p className="text-sm font-semibold leading-snug text-paper transition-colors group-hover:text-link">
                            {item.title}
                          </p>
                          <p className="mt-2 text-xs font-semibold text-link">Lire l’article →</p>
                        </div>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>
    </article>
  );
}
