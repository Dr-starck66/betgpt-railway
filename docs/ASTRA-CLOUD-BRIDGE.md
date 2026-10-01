# ASTRA CLOUD BRIDGE Ω

ASTRA CLOUD BRIDGE remplace Railway Agent comme couche de preuve et de routage externe.

## Principe

Le bridge ne dépend d'aucun agent d'hébergeur. Il s'exécute depuis un runner GitHub externe, sonde chaque cible réelle en HTTP, applique des assertions fonctionnelles, produit un ledger de preuves JSON/Markdown et sélectionne la première cible saine par priorité.

- **Primary** : domaine/public cloud indépendant.
- **Fallback** : Railway ou toute autre origine marquée `fallback: true`.
- **FAIL fermé** : aucune cible n'est déclarée saine si les assertions métier échouent.
- **Preuve réelle** : code HTTP, latence, extrait de réponse, assertions et cible sélectionnée.
- **Réutilisable** : ajouter Vercel, Netlify, Render, Cloudflare ou un autre endpoint revient à ajouter une entrée dans le JSON.

## Lancer

`node scripts/astra-cloud-bridge.mjs config/astra-cloud-bridge.json`

Les preuves sont écrites dans `artifacts/astra-cloud-bridge-evidence.json` et `artifacts/astra-cloud-bridge-summary.md`.

## Politique BetGPT

Le POST conversationnel du jour doit répondre avec au moins un pari concret possédant `Niveau`, `Pari à prendre` et `Cote disponible`. Une réponse qui demande à l'utilisateur de fournir les affiches est automatiquement classée FAIL.

Railway n'est plus requis pour cette vérification. Il n'est qu'une cible de secours dans la configuration actuelle.
