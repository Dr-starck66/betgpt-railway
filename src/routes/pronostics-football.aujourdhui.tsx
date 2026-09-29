import { createFileRoute } from "@tanstack/react-router";
import { PronoSilo, filterSiloMatches } from "@/components/prono-silo";
import { getDayDesk } from "@/lib/desk.functions";
import { parisOffsetDay, siloIndexable } from "@/lib/seo/money-map";
import { SITE_URL } from "@/lib/programmatic";

export const Route = createFileRoute("/pronostics-football/aujourdhui")({
  loader: () => getDayDesk({ data: { day: parisOffsetDay(0) } }),
  head: ({ loaderData }) => {
    const day = parisOffsetDay(0);
    const n = loaderData ? filterSiloMatches(loaderData, { day }).length : 0;
    const title = "Pronostics football aujourd’hui | BetGPT";
    return {
      meta: [
        { title },
        {
          name: "description",
          content: `Pronostics football du ${day}, heure de Paris. Uniquement les matchs présents dans le bureau BetGPT.`,
        },
        { name: "robots", content: siloIndexable("day", n) ? "index, follow" : "noindex, follow" },
        { property: "og:url", content: `${SITE_URL}/pronostics-football/aujourdhui` },
      ],
      links: [{ rel: "canonical", href: `${SITE_URL}/pronostics-football/aujourdhui` }],
    };
  },
  component: Page,
});

function Page() {
  const desk = Route.useLoaderData();
  const day = parisOffsetDay(0);
  return (
    <PronoSilo
      h1="Pronostics football aujourd’hui"
      lead={`Matchs dont le coup d’envoi tombe le ${day} à Paris. Si la liste est vide, la page n’est pas proposée à l’index.`}
      path="/pronostics-football/aujourdhui"
      kind="day"
      desk={desk}
      filter={{ day }}
      crumbs={[
        { href: "/pronostics-sportifs", name: "Pronostics sportifs" },
        { href: "/pronostics-football", name: "Football" },
        { href: "/pronostics-football/aujourdhui", name: "Aujourd’hui" },
      ]}
    />
  );
}
