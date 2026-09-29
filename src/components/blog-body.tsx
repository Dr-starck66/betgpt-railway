import { Fragment, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { BlogArticle } from "@/lib/blog";
import {
  INLINE_LINKS,
  blogCover,
  blogInline,
  blogTable,
  blogTakeaways,
  sectionSubs,
  slugHeading,
  type BlogImg,
} from "@/lib/blog-rich";
import { SeoImg } from "@/components/seo-img";

function linkify(text: string): ReactNode {
  const sorted = [...INLINE_LINKS].sort((a, b) => b.phrase.length - a.phrase.length);
  const rx = new RegExp(`(${sorted.map((l) => l.phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  const parts = text.split(rx);
  return parts.map((part, i) => {
    const hit = sorted.find((l) => l.phrase.toLowerCase() === part.toLowerCase());
    if (!hit) return <Fragment key={i}>{part}</Fragment>;
    if (hit.href.startsWith("/blog/")) {
      const slug = hit.href.replace("/blog/", "");
      return (
        <Link key={i} to="/blog/$slug" params={{ slug }} className="text-sage underline decoration-sage/40 underline-offset-2">
          {part}
        </Link>
      );
    }
    return (
      <a key={i} href={hit.href} className="text-sage underline decoration-sage/40 underline-offset-2">
        {part}
      </a>
    );
  });
}

function BlogFigure({ img, priority }: { img: BlogImg; priority?: boolean }) {
  return (
    <SeoImg
      seo={img}
      caption
      priority={priority}
      width={1200}
      height={675}
      className="aspect-video h-auto w-full object-cover"
      figureClassName="rounded-xl border border-line bg-surface"
    />
  );
}

export function BlogBody({ article: a }: { article: BlogArticle }) {
  const cover = blogCover(a);
  const inline = blogInline(a);
  const table = blogTable(a);
  const keys = blogTakeaways(a);
  const toc = [
    { id: "sommaire", label: "Sommaire" },
    { id: "points-cles", label: "Points clés" },
    ...a.paragraphs.map((p) => ({ id: slugHeading(p.h2), label: p.h2 })),
    { id: "tableau", label: table.caption },
    { id: "faq", label: "Questions fréquentes" },
    { id: "lire-aussi", label: "Pour aller plus loin" },
  ];

  return (
    <div className="blog-article space-y-8">
      <BlogFigure img={cover} priority />

      <nav id="sommaire" aria-labelledby="h-sommaire" className="rounded-lg border border-line bg-surface p-4">
        <h2 id="h-sommaire" className="text-lg font-semibold">
          Sommaire
        </h2>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
          {toc.map((t) => (
            <li key={t.id}>
              <a href={`#${t.id}`} className="text-sage hover:underline">
                {t.label}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <section id="points-cles" className="rounded-lg border border-sage/30 bg-surface p-4">
        <h2 className="text-lg font-semibold">Points clés</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-paper">
          {keys.map((k) => (
            <li key={k}>{linkify(k)}</li>
          ))}
        </ul>
      </section>

      {a.paragraphs.map((p, i) => {
        const id = slugHeading(p.h2);
        const subs = sectionSubs(p.h2, p.body);
        return (
          <section key={id} id={id} className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight">{p.h2}</h2>
            <p className="text-sm leading-relaxed text-paper">{linkify(p.body)}</p>
            {i === 0 ? <BlogFigure img={inline} /> : null}
            {subs.map((s) => (
              <div key={s.h3}>
                <h3 className="text-base font-semibold text-paper" id={slugHeading(s.h3)}>
                  {s.h3}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-mist">{linkify(s.text)}</p>
              </div>
            ))}
          </section>
        );
      })}

      <section id="tableau">
        <h2 className="text-xl font-semibold tracking-tight">{table.caption}</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <caption className="sr-only">{table.caption}</caption>
            <thead className="bg-raised">
              <tr>
                {table.headers.map((h) => (
                  <th key={h} scope="col" className="border-b border-line px-3 py-2 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row) => (
                <tr key={row.join("|")} className="odd:bg-surface">
                  {row.map((cell, i) => (
                    <td key={i} className="border-b border-line/70 px-3 py-2 text-paper">
                      {i === 0 ? <strong>{linkify(cell)}</strong> : linkify(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export function BlogFaq({ article: a }: { article: BlogArticle }) {
  return (
    <section id="faq" className="space-y-4">
      <h2 className="text-xl font-semibold tracking-tight">Questions fréquentes</h2>
      {a.faq.map((f) => (
        <div key={f.q}>
          <h3 className="text-base font-semibold" id={slugHeading(f.q)}>
            {f.q}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-paper">{linkify(f.a)}</p>
        </div>
      ))}
    </section>
  );
}
