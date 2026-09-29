import { createFileRoute } from "@tanstack/react-router";
import { PronoSilo, filterSiloMatches } from "@/components/prono-silo";
import { getDayDesk } from "@/lib/desk.functions";
import { parisOffsetDay, siloIndexable } from "@/lib/seo/money-map";
import { SITE_URL } from "@/lib/programmatic";

export const Route = createFileRoute("/pronostics-football/demain")({
  loader: () => getDayDesk({ data: { day: parisOffsetDay(1) } }),
  head: ({ loaderData }) => {
    const day = parisOffsetDay(1);
    const n = loaderData ? filterSiloMatches(loaderData, { day }).length : 0;
    return {
      meta: [
        { title: "Pronostics football demain | BetGPT" },
        {
          name: "description",
          content: `Pronostics football du ${day}, heure de Paris, si ces matchs sont déjà dans le bureau.`,
        },
        { name: "robots", content: siloIndexable("day", n) ? "index, follow" : "noindex, follow" },
        { property: "og:url", content: `${SITE_URL}/pronostics-football/demain` },
      ],
      links: [{ rel: "canonical", href: `${SITE_URL}/pronostics-football/demain` }],
    };
  },
  component: Page,
});

function Page() {
  const desk = Route.useLoaderData();
  const day = parisOffsetDay(1);
  return (
    <PronoSilo
      h1="Pronostics football demain"
      lead={`Matchs du ${day} à Paris déjà estimés. Pas de calendrier fictif.`}
      path="/pronostics-football/demain"
      kind="day"
      desk={desk}
      filter={{ day }}
      crumbs={[
        { href: "/pronostics-sportifs", name: "Pronostics sportifs" },
        { href: "/pronostics-football", name: "Football" },
        { href: "/pronostics-football/demain", name: "Demain" },
      ]}
    />
  );
}
