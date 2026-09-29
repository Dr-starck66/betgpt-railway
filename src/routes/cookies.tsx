import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/legal-layout";
import { openCookieSettings } from "@/components/consent-ads";
import { SITE_URL } from "@/lib/programmatic";

export const Route = createFileRoute("/cookies")({
  head: () => ({
    meta: [
      { title: "Politique de cookies | BetGPT" },
      {
        name: "description",
        content:
          "Politique cookies BetGPT : essentiels, affiliation, publicité Google AdSense, durées, consentement, comment les refuser.",
      },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/cookies` }],
  }),
  component: CookiesPage,
});

function CookiesPage() {
  return (
    <LegalLayout title="Politique de cookies">
      <p>
        Cette page décrit les cookies et traceurs utilisés sur betgpt.live, conformément à la
        directive ePrivacy et au RGPD. Dernière mise à jour : 8 septembre 2026.
      </p>
      <p>
        Un cookie est un petit fichier déposé sur ton appareil. Certains sont indispensables au
        site. D’autres (publicité) ne sont déposés <strong>qu’avec ton accord</strong>.
      </p>
      <p>
        <button type="button" className="rounded-md bg-sage px-3 py-2 text-sm font-semibold text-ink" onClick={() => openCookieSettings()}>
          Gérer mes cookies
        </button>
      </p>

      <h2 className="pt-2 text-lg font-semibold">1. Cookies essentiels (pas de consentement)</h2>
      <p>Ils permettent le fonctionnement du site. Tu peux les bloquer dans le navigateur, le site peut alors mal marcher.</p>
      <CookieTable
        rows={[
          ["betgpt-18", "BetGPT", "Âge déclaré 18+", "12 mois", "Essentiel"],
          ["betgpt-consent", "BetGPT", "Choix cookies (essentiels / pub)", "13 mois", "Essentiel"],
          ["betgpt-admin", "BetGPT", "Session rédaction (appareil admin seulement)", "Session", "Essentiel"],
        ]}
      />

      <h2 className="pt-2 text-lg font-semibold">2. Cookies publicitaires (consentement)</h2>
      <p>
        Uniquement si tu cliques « Accepter la pub ». Partenaire : Google Ireland Limited (AdSense /
        DoubleClick). Ils mesurent et personnalisent des annonces.
      </p>
      <CookieTable
        rows={[
          ["_gads / IDE / DSID", "Google", "Diffusion et mesure d’annonces AdSense", "jusqu’à 13 mois", "Publicité"],
          ["NID", "Google", "Préférences et pubs Search / AdSense", "6 mois", "Publicité"],
        ]}
      />
      <p>
        Désinscription :{" "}
        <a href="https://www.google.com/settings/ads" className="text-sage underline">
          Paramètres des annonces Google
        </a>{" "}
        ·{" "}
        <a href="https://www.youronlinechoices.com/fr/" className="text-sage underline">
          YourOnlineChoices
        </a>
        . Politique Google :{" "}
        <a href="https://policies.google.com/technologies/cookies" className="text-sage underline">
          cookies Google
        </a>
        .
      </p>

      <h2 className="pt-2 text-lg font-semibold">3. Cookies des bookmakers (hors BetGPT)</h2>
      <p>
        Si tu cliques « Parier » (lien sponsorisé), tu quittes betgpt.live. Unibet, Betclic, NetBet,
        Winamax, etc. peuvent déposer leurs propres cookies (affiliation, compte). Ce n’est plus
        notre site : lis leur politique cookies.
      </p>

      <h2 className="pt-2 text-lg font-semibold">4. Comment refuser ou retirer</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Bouton « Gérer mes cookies » ci-dessus, ou pied de page.</li>
        <li>Choix « Essentiels seulement » : pas de script AdSense.</li>
        <li>Navigateur : bloquer les cookies tiers (Chrome, Firefox, Safari, Edge).</li>
        <li>iOS / Android : suivi publicitaire limité dans les réglages.</li>
      </ul>

      <h2 className="pt-2 text-lg font-semibold">5. Durée du consentement</h2>
      <p>
        Ton choix est stocké 13 mois, puis le bandeau revient. Tu peux le changer à tout moment. Pas
        de revente de listes. Détail des traitements :{" "}
        <a href="/confidentialite" className="text-sage">
          politique de confidentialité
        </a>{" "}
        ·{" "}
        <a href="/politique-publicite" className="text-sage">
          politique publicitaire
        </a>
        .
      </p>
    </LegalLayout>
  );
}

function CookieTable({ rows }: { rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-line">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead className="bg-raised text-[11px] uppercase tracking-wider text-muted">
          <tr>
            <th className="px-2 py-2">Nom</th>
            <th className="px-2 py-2">Éditeur</th>
            <th className="px-2 py-2">Finalité</th>
            <th className="px-2 py-2">Durée</th>
            <th className="px-2 py-2">Type</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[0]} className="border-t border-line">
              {r.map((c) => (
                <td key={c} className="px-2 py-2 align-top">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
