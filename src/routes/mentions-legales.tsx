import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/legal-layout";
import { getLegal } from "@/lib/desk.functions";
import { SITE_URL } from "@/lib/programmatic";

export const Route = createFileRoute("/mentions-legales")({
  loader: () => getLegal(),
  head: () => ({
    meta: [
      { title: "Mentions légales | BetGPT" },
      { name: "description", content: "Éditeur, hébergeur et mentions légales de betgpt.live." },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/mentions-legales` }],
  }),
  component: Mentions,
});

function Mentions() {
  const l = Route.useLoaderData();
  return (
    <LegalLayout title="Mentions légales">
      {l.ready ? (
        <>
          <p>
            <strong>Éditeur</strong> : {l.name}. SIRET : {l.siret}. {l.address}.
            {l.tva ? ` TVA : ${l.tva}.` : ""}
          </p>
          <p>
            <strong>Directeur de la publication</strong> : {l.director}.
          </p>
        </>
      ) : (
        <p>
          <strong>Éditeur</strong> : {l.name}. L’identité commerciale (SIRET, adresse, directeur de
          publication) n’est pas encore renseignée. BetGPT n’est pas présenté ici comme une société
          immatriculée.
        </p>
      )}
      <p>
        <strong>Contact</strong> : <a href={`mailto:${l.email}`}>{l.email}</a>
      </p>
      <p>
        <strong>Hébergeur</strong> : {l.host}.
      </p>
      <p>
        BetGPT n’est pas un opérateur de paris. Les opérateurs liés (Betclic, Unibet, NetBet, Winamax,
        etc.) sont agréés ANJ. Les boutons « Parier » sont des liens d’affiliation, éventuellement
        rémunérés.
      </p>
      <h2 className="text-lg font-semibold">Intelligence artificielle</h2>
      <p>
        Le chat BetGPT s’appuie sur le modèle Grok opéré par xAI (États-Unis). Lorsque tu envoies un
        message, son contenu et le contexte statistique du desk sont transmis à xAI pour générer une
        réponse. Ces messages ne sont pas utilisés pour entraîner un modèle BetGPT. Politique de
        confidentialité xAI :{" "}
        <a href="https://x.ai/legal/privacy-policy" className="text-sage underline">
          x.ai/legal/privacy-policy
        </a>
        . Transfert hors UE : clauses contractuelles types / cadre applicable.
      </p>
      <p>Jeu interdit aux mineurs. 18+.</p>
    </LegalLayout>
  );
}
