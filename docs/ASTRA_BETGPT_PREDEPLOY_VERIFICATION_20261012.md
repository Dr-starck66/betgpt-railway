# BetGPT — vérification isolée ASTRA Ω (2026-10-12)

Cette PR n'est pas destinée à être fusionnée en production. Elle sert à faire exécuter les tests du moteur ASTRA MASTER GATE puis les contrôles stricts du site dans GitHub Actions. Toute brique sans preuve reste UNVERIFIED ; un résultat global FAIL ne doit jamais être déguisé en PASS.

Le service Railway `betgpt-complete-v6` utilise encore un commit datant du 1er octobre : les nouveaux journaux de publication n'ont pas de preuve de déploiement. Aucun déploiement automatique n'est demandé par cette PR.
