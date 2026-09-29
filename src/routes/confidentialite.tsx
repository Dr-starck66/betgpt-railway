import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/legal-layout";
import { getLegal } from "@/lib/desk.functions";
import { SITE_URL } from "@/lib/programmatic";

export const Route = createFileRoute("/confidentialite")({
  loader: () => getLegal(),
  head: () => ({
    meta: [
      { title: "Politique de confidentialité RGPD | BetGPT" },
      { name: "description", content: "Données collectées par BetGPT, finalités, durée, tes droits RGPD." },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/confidentialite` }],
  }),
  component: Page,
});

function Page() {
  const l = Route.useLoaderData();
  return (
    <LegalLayout title="Politique de confidentialité">
      <p>Dernière mise à jour : 8 septembre 2026.</p>
      <p>
        <strong>Responsable de traitement</strong> : {l.name}
        {l.ready && l.address ? `, ${l.address}` : ""}. Contact DPO / privacy :{" "}
        <a href={`mailto:${l.email}`}>{l.email}</a>. Hébergeur : {l.host}.
      </p>
      <h2 className="text-lg font-semibold">Données traitées</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Consultation des pages (logs techniques : IP, user-agent, URL, horodatage) — sécurité, 13 mois.</li>
        <li>Clics affiliés (book, match, date) — commission, 13 mois.</li>
        <li>Âge déclaré 18+ (stockage local, pas de serveur) — obligation légale jeux.</li>
        <li>Choix cookies (stockage local).</li>
        <li>Messages du chat si tu l’utilises — transmis à xAI (Grok) pour la réponse, conservation BetGPT 13 mois max.</li>
        <li>E-mail si tu nous écris via Contact — réponse, puis 3 ans.</li>
      </ul>
      <p>Pas de compte joueur, pas de pièce d’identité, pas de carte bancaire, pas de géolocalisation précise.</p>
      <h2 className="text-lg font-semibold">Bases légales</h2>
      <p>
        Intérêt légitime (sécurité, affiliation, contenu) ; obligation légale (18+, mentions) ;
        consentement (cookies publicitaires AdSense) ; exécution de mesures précontractuelles (réponse
        à un e-mail).
      </p>
      <h2 className="text-lg font-semibold">Destinataires</h2>
      <p>
        Hébergeur (Vercel, États-Unis — clauses types). Google Ireland Ltd si tu acceptes la pub
        (AdSense). Bookmakers agréés ANJ seulement si tu cliques « Parier ». xAI (États-Unis) si tu
        utilises le chat BetGPT (contenu du message + contexte statistique du desk, pour générer une
        réponse — pas d’entraînement d’un modèle BetGPT).{" "}
        <a href="https://x.ai/legal/privacy-policy" className="text-sage underline">
          Confidentialité xAI
        </a>
        . Pas de vente de fichiers.
      </p>
      <h2 className="text-lg font-semibold">Transferts hors UE</h2>
      <p>
        Hébergement et Google peuvent transférer vers les États-Unis. Cadre : clauses contractuelles
        types / Data Privacy Framework le cas échéant.
      </p>
      <h2 className="text-lg font-semibold">Tes droits (RGPD)</h2>
      <p>
        Accès, rectification, effacement, limitation, opposition, portabilité, retrait du
        consentement. Écris à {l.email}. Réclamation :{" "}
        <a href="https://www.cnil.fr" className="text-sage underline">
          CNIL
        </a>
        . Cookies :{" "}
        <a href="/cookies" className="text-sage">
          politique cookies
        </a>
        .
      </p>
      <p>
        Pubs Google :{" "}
        <a href="https://www.google.com/settings/ads" className="text-sage underline">
          ads settings
        </a>{" "}
        ·{" "}
        <a href="https://policies.google.com/privacy" className="text-sage underline">
          Confidentialité Google
        </a>
        .
      </p>
    </LegalLayout>
  );
}
