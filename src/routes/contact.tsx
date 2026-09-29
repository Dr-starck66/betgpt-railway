import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/legal-layout";
import { getLegal } from "@/lib/desk.functions";
import { SITE_URL } from "@/lib/programmatic";

export const Route = createFileRoute("/contact")({
  loader: () => getLegal(),
  head: () => ({
    meta: [
      { title: "Contact | BetGPT" },
      { name: "description", content: "Contacter la rédaction BetGPT." },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/contact` }],
  }),
  component: Page,
});

function Page() {
  const l = Route.useLoaderData();
  return (
    <LegalLayout title="Contact">
      <p>Rédaction et réclamations : {l.name}.</p>
      <p>
        E-mail : <a href={`mailto:${l.email}`} className="text-sage">{l.email}</a>
      </p>
      <p>{l.address}</p>
      <p className="text-mist">Délai de réponse visé : 7 jours ouvrés. Pas de support paris / retraits : voir le bookmaker.</p>
    </LegalLayout>
  );
}
