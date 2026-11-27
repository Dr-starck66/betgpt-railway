# ASTRA EDITORIAL VIDEO Ω v0.2

Extension de la PR #153. Réutilise scripts/astra-viral-clip.mjs. Dépendances locales : Python 3, Node, FFmpeg/FFprobe avec libass/libx264, eSpeak et DejaVu Sans. Aucun service payant ni secret nécessaire.

Depuis la racine du dépôt, sur la branche de la PR :

```sh
python scripts/astra-editorial-video.py demo/articles demo/output
python scripts/test_editorial_video.py
python scripts/astra-editorial-video.py demo/articles demo/output
```

Entrée : JSON unique ou répertoire de JSON. Profils français GamicNews, FreeHotels, WINE ELSE, ASTRA Science. Deux à cinq phrases exactes sélectionnées parmi des paragraphes distincts, 65–120 caractères. Un article insuffisant est refusé. Ne génère pas de faits ni de minutage de mots artificiel. Voix eSpeak, cartes typographiques, sous-titres par segment. Contrôle de droits déclaratif, pas une authentification. Identifiant site/article, empreintes SHA-256, sortie atomique locale, verrou par article. Relance du même JSON : vérification des empreintes et SKIP_VERIFIED. Un changement sous le même ID ou une corruption est refusé. Répertoire de sortie à réserver à un opérateur de confiance. Un verrou orphelin doit être inspecté avant retrait manuel.

## Preuves de session

Deux textes originaux de démonstration, quatre MP4 de 7 s, 1080×1920, 30 fps, audio, décodables, aucune séquence noire détectée, 14,89 s mesurées pour le lot. Tests supplémentaires : 8/8 PASS ; relance des deux articles SKIP_VERIFIED. Moteur v0.1 local blob a127af7166c0f18fa6dc845e4a3cdd90f2bccbbe identique au dépôt. Le module historique de preuve local est un extrait compatible ; checkout et CI distants non exécutés. Aucun article live ingéré ni post social envoyé. Qualité commerciale, runtime persistant, ingestion automatique après publication et distribution : UNVERIFIED. Aucune nouvelle dépense engagée.
