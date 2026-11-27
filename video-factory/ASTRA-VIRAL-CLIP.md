# ASTRA LAUNCH VIDEO Ω — extension VIRAL CLIP v0.1

Le moteur de découpage réutilise directement les fonctions probeVideo, detectBlack, evaluateProbe et sha256File de scripts/lib/astra-launch-video.mjs. Aucun nouveau service, abonnement, workflow GitHub Actions ou changement de production. Node.js, FFmpeg (libass/libx264), FFprobe et DejaVu Sans requis.

## Commandes

    node scripts/astra-viral-clip.integration.test.mjs
    node scripts/astra-viral-clip.mjs job.json source.mp4 output-dir

Exemple job.json:
    {"site":"gamicnews","brand":"GamicNews","language":"fr","topic":"Gaming","rights":{"status":"owned","reference":"Identifiant du justificatif de droits"},"segments":[{"start":0,"end":10,"topic":"Tutoriel","text":"Texte exact du passage."}]}

Les segments doivent être chronologiques, non chevauchants et compris dans la vidéo. Option words: liste de {start,end,text} avec minutages absolus. Sélection de cinq segments au maximum, 7–60 s, sujets distincts, score heuristique et non prédictif. Sans mots minutés, texte court seulement. MP4 local, maximum 512 Mio. Déclaration de droits obligatoire mais non authentifiée. Ne pas traiter des médias non fiables hors bac à sable.

## Origines et limites

Lecture des dépôts MIT pedroxcardoso/maquina-cortes-gta et gzonlin/gtavi-claudecode : principes de sélection par sujet et rendu ASS/vertical, sans exécuter leurs installateurs ni copier leurs fichiers. Pas de Remotion ni API payante. Le transcript doit être fourni : Whisper, acquisition, publication, monétisation et runtime permanent non intégrés.

## Audit

Conteneur local Node 22 + FFmpeg 7.1.5 : 13 tests locaux + 2 tests autonomes, tous PASS. Trois maquettes de 8 s, 1080x1920, 30 fps, H.264/AAC, décodables; sources synthétiques originales. Refus de la source noire vérifié après correction. Le code local a utilisé un extrait compatible des fonctions de preuve existantes, pas le checkout complet : intégration native distante UNVERIFIED. Audio mesuré entre -16,1 et -15,5 LUFS malgré la cible -14. Pas de publication. Les scores ne sont pas une preuve de viralité. Aucun site de production modifié.
