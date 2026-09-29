import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { TeamLine } from "@/components/crest";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { citeBySlug } from "@/engine/cite-public";
import { getPublicDesk } from "@/lib/desk.functions";
import { SITE_URL } from "@/lib/programmatic";
import { ld } from "@/lib/ld";

export const Route = createFileRoute("/calendrier/$slug")({
  loader: async ({ params }) => {
    const meta = citeBySlug(params.slug);
    if (!meta) throw notFound();
    const data = await getPublicDesk();
    const matches = data.matches.filter((m) => m.league === meta.league);
    return { meta, matches };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const { meta, matches } = loaderData;
    const next = matches[0];
    const desc = next
      ? `Calendrier ${meta.title} : prochain match ${next.home.name} – ${next.away.name}. ${matches.length} rencontres. BetGPT.`
      : `Calendrier ${meta.title} sur betgpt.live.`;
    return {
      meta: [
        { title: `Calendrier ${meta.title} : dates et horaires | BetGPT` },
        { name: "description", content: desc },
      ],
      links: [{ rel: "canonical", href: `${SITE_URL}/calendrier/${meta.slug}` }],
    };
  },
  notFoundComponent: () => <p className="text-muted">Calendrier introuvable.</p>,
  component: CalPage,
});

function CalPage() {
  const { meta, matches } = Route.useLoaderData();
  const next = matches[0];
  const answer = next
    ? `Calendrier ${meta.title} : prochain match ${next.home.name} – ${next.away.name} le ${format(new Date(next.kickoff), "EEEE d MMMM 'à' HH:mm", { locale: fr })}. ${matches.length} matchs listés.`
    : `Calendrier ${meta.title} : aucune rencontre sur cette fenêtre.`;
  return (
    <article className="space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: ld({
            "@context": "https://schema.org",
            "@type": "Dataset",
            name: `Calendrier ${meta.title}`,
            description: answer,
            url: `${SITE_URL}/calendrier/${meta.slug}`,
            creator: { "@type": "Organization", name: "BetGPT", url: SITE_URL },
          }),
        }}
      />
      <h1 className="text-2xl font-semibold tracking-tight">Calendrier {meta.title}</h1>
      <p className="seo-answer text-base font-medium text-paper">{answer}</p>
      <table className="w-full text-sm">
        <thead className="bg-raised text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
          <tr>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Match</th>
            <th className="px-3 py-2">Stade</th>
          </tr>
        </thead>
        <tbody>
          {matches.map((m) => (
            <tr key={m.id} className="border-t border-line">
              <td className="px-3 py-2">
                <time dateTime={m.kickoff}>{format(new Date(m.kickoff), "EEE d MMM HH:mm", { locale: fr })}</time>
              </td>
              <td className="px-3 py-2">
                <Link to="/match/$matchId" params={{ matchId: m.slug ?? m.id }} className="hover:text-sage">
                  <TeamLine home={m.home} away={m.away} size={24} names="full" competition={m.competition} />
                </Link>
              </td>
              <td className="px-3 py-2 text-mist">{m.venue}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}
