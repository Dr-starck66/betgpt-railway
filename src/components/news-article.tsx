import { Link } from "@tanstack/react-router";
import { newsArticleLd, breadcrumbLd } from "@/lib/editorial/schema";
import { formatParis } from "@/lib/editorial/time";
import type { EditorialArticle, EditorialSource } from "@/lib/editorial/types";
import { ld } from "@/lib/ld";

function renderParagraphs(article: EditorialArticle) {
  const hasNestedHeadings = article.paragraphs.some((part) => (part.h3?.length ?? 0) > 0);
  if (hasNestedHeadings || article.articleType !== "news" || article.paragraphs.length < 5) return article.paragraphs;

  const sourceSubsections = article.sources
    .filter((source) => source.note?.trim())
    .slice(0, 5)
    .map((source) => ({
      h3: `${source.label} : ce que la source apporte`,
      body: source.note.trim(),
    }));
  if (sourceSubsections.length < 2) return article.paragraphs;

  let targetIndex = article.paragraphs.findIndex((part) =>
    /source|disent|confir|établi|corrobor|preuve/i.test(part.h2),
  );
  if (targetIndex < 0) targetIndex = article.paragraphs.findIndex((part) => part.body.length >= 500);
  if (targetIndex < 0) return article.paragraphs;

  return article.paragraphs.map((part, index) =>
    index === targetIndex ? { ...part, h3: sourceSubsections } : part,
  );
}

export function NewsArticleView({ article }: { article: EditorialArticle }) {
  const published = formatParis(article.publishedAt);
  const modified =
    article.modifiedAt && article.publishedAt && article.modifiedAt > article.publishedAt
      ? formatParis(article.modifiedAt)
      : null;
  const paragraphs = renderParagraphs(article);

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

          {paragraphs.map((part) => {
            const passageSources = (part.sourceIds ?? [])
              .map((sourceId) => article.sources.find((source) => source.id === sourceId))
              .filter((source): source is EditorialSource & { url: string } => Boolean(source?.url));

            return (
              <section key={part.h2} className="surface-card space-y-4 p-5 sm:p-7">
                <h2 className="text-2xl font-semibold tracking-tight">{part.h2}</h2>
                <p className="readable-prose">{part.body}</p>
                {part.h3?.map((subsection) => (
                  <div key={subsection.h3} className="space-y-3 border-l-2 border-line pl-4 sm:pl-5">
                    <h3 className="text-xl font-semibold tracking-tight text-paper">{subsection.h3}</h3>
                    <p className="readable-prose">{subsection.body}</p>
                    {subsection.h4?.map((detail) => (
                      <div key={detail.h4} className="space-y-2 pl-3 sm:pl-4">
                        <h4 className="text-base font-semibold tracking-tight text-paper">{detail.h4}</h4>
                        <p className="readable-prose">{detail.body}</p>
                      </div>
                    ))}
                  </div>
                ))}
                {passageSources.length ? (
                  <p className="border-t border-line pt-3 text-xs leading-relaxed text-muted">
                    <span className="font-semibold text-mist">Sources de ce passage : </span>
                    {passageSources.map((source, index) => (
                      <span key={source.id}>
                        {index ? " · " : ""}
                        <a href={source.url} className="font-semibold text-link hover:underline">
                          {source.label}
                        </a>
                      </span>
                    ))}
                  </p>
                ) : null}
              </section>
            );
          })}

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
              <ul className="mt-4 space-y-3 text-sm leading-relaxed">
                {article.related.map((item) => (
                  <li key={item.href}>
                    <a href={item.href} className="font-medium text-paper hover:text-link">
                      {item.title}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>
    </article>
  );
}
