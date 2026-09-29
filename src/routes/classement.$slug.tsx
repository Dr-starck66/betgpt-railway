import { createFileRoute, notFound } from "@tanstack/react-router";
import { citeBySlug, classementAnswer } from "@/engine/cite-public";
import { loadCite } from "@/lib/cite.functions";
import { SITE_URL } from "@/lib/programmatic";
import { Crest } from "@/components/crest";
import { ld } from "@/lib/ld";

export const Route = createFileRoute("/classement/$slug")({
  loader: async ({ params }) => {
    const meta = citeBySlug(params.slug);
    if (!meta) throw notFound();
    const data = await loadCite();
    const league = data.leagues.find((l) => l.slug === params.slug);
    if (!league) throw notFound();
    return league;
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const title = `Classement ${loaderData.title} : tableau et points | BetGPT`;
    const desc = classementAnswer(loaderData.title, loaderData.rows);
    const url = `${SITE_URL}/classement/${loaderData.slug}`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  notFoundComponent: () => <p className="text-muted">Classement introuvable.</p>,
  component: TablePage,
});

function TablePage() {
  const l = Route.useLoaderData();
  const answer = classementAnswer(l.title, l.rows);
  const faq = [
    { q: `Quel est le classement de ${l.title} ?`, a: answer },
    { q: `Classement ${l.title}`, a: answer },
    { q: `Qui est premier de ${l.title} ?`, a: l.rows[0] ? `${l.rows[0].name} mène ${l.title} avec ${l.rows[0].pts} points.` : answer },
  ];
  return (
    <article className="space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: ld([
            {
              "@context": "https://schema.org",
              "@type": "Dataset",
              name: `Classement ${l.title}`,
              url: `${SITE_URL}/classement/${l.slug}`,
              description: answer,
              creator: { "@type": "NewsMediaOrganization", name: "BetGPT", url: SITE_URL },
              temporalCoverage: new Date().toISOString().slice(0, 10),
            },
            {
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: faq.map((f) => ({
                "@type": "Question",
                name: f.q,
                acceptedAnswer: { "@type": "Answer", text: f.a },
              })),
            },
          ]),
        }}
      />
      <h1 className="text-2xl font-semibold tracking-tight">Classement {l.title}</h1>
      <p className="seo-answer text-base font-medium text-paper">{answer}</p>
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-raised text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Équipe</th>
              <th className="px-3 py-2">J</th>
              <th className="px-3 py-2">G</th>
              <th className="px-3 py-2">N</th>
              <th className="px-3 py-2">P</th>
              <th className="px-3 py-2">Pts</th>
            </tr>
          </thead>
          <tbody>
            {l.rows.map((r) => (
              <tr key={r.name} className="border-t border-line">
                <td className="px-3 py-2 tabular">{r.rank}</td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-2">
                    <Crest name={r.name} short={r.short} logo={r.logo} size={24} />
                    {r.name}
                  </span>
                </td>
                <td className="px-3 py-2 tabular">{r.gp}</td>
                <td className="px-3 py-2 tabular">{r.w}</td>
                <td className="px-3 py-2 tabular">{r.d}</td>
                <td className="px-3 py-2 tabular">{r.l}</td>
                <td className="px-3 py-2 tabular font-medium">{r.pts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold">Questions classement {l.title}</h2>
        <dl className="mt-3 space-y-3">
          {faq.map((f) => (
            <div key={f.q}>
              <dt className="text-sm font-medium">{f.q}</dt>
              <dd className="mt-1 text-sm text-mist">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </article>
  );
}
