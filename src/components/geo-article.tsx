import { SharePage } from "@/components/share-page";
import { ld } from "@/lib/ld";
import type { GeoDoc } from "@/lib/geo/entity";
import { geoCanonical } from "@/lib/geo/entity";
import { geoJsonLd } from "@/lib/geo/schema";

export function GeoArticle({ doc }: { doc: GeoDoc }) {
  const url = geoCanonical(doc.path);
  return (
    <article className="mx-auto max-w-2xl space-y-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld(geoJsonLd(doc)) }} />
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-sage">BetGPT</p>
        <h1 className="text-2xl font-semibold tracking-tight text-paper sm:text-3xl">{doc.h1}</h1>
        <p className="seo-answer text-base leading-relaxed text-paper">{doc.answer}</p>
        <p className="text-xs text-muted">Révision éditoriale : {doc.updated}. 18+.</p>
        <SharePage url={url} title={doc.title} />
      </header>
      {doc.sections.map((section) => (
        <section key={section.h2} className="space-y-2">
          <h2 className="text-lg font-semibold text-paper">{section.h2}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph.slice(0, 48)} className="text-sm leading-relaxed text-mist">
              {paragraph}
            </p>
          ))}
          {section.items?.length ? (
            <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-mist">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
      <nav aria-label="Pages liées" className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {doc.links.map((link) => (
          <a key={link.href} href={link.href} className="text-sage hover:underline">
            {link.label}
          </a>
        ))}
      </nav>
    </article>
  );
}
