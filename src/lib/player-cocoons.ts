/**
 * ASTRA PLAYERS EDITORIAL — ten independent topical clusters.
 * Evidence: Chris Laas monthly Google-query estimates, published June 2026
 * (historical global study, NOT the real-time October 2026 Google Trends top ten).
 * Each cocoon becomes public by Paris calendar date without a cron or process restart.
 * No made-up match scores, transfers, awards, quotes or Google placements.
 */
import type { BlogArticle } from "@/lib/blog";
import { PLAYER_BIOGRAPHIES } from "@/lib/player-biographies";

export const PLAYER_RANKING_SOURCE = "https://sportune.20minutes.fr/mbappe-4e-les-10-joueurs-du-mondial-2026-les-plus-recherches-sur-google-404710";
export const PLAYER_EDITORIAL_SERIES = "Recherches Google football : étude publiée en juin 2026, estimations moyennes historiques et non tendance temps réel";
const START = Date.parse("2026-10-17T05:40:00.000Z");
const TWO_DAYS = 48 * 60 * 60 * 1000;

// Bespoke scouting notes: interpretive journalism; no invented current-season statistics.
type Player = {
  name: string; slug: string; rank: number; monthly: number;
  nation: string; archetype: string; profile: string; mechanism: string;
  withoutBall: string; keyDuel: string; vulnerability: string; angle: string;
  comparison: string; observation: string; image: string;
};
export const PLAYER_PROFILES: Player[] = [
  {name:"Cristiano Ronaldo",slug:"cristiano-ronaldo",rank:1,monthly:10156667,nation:"Portugal",
   archetype:"finisseur, appels dans la surface et jeu aérien",
   profile:"Ronaldo a progressivement bâti une grammaire de buteur de surface : l'attaque du premier poteau, le timing au second et la capacité à couper une trajectoire avant un défenseur. Son intérêt ne se réduit pas au geste spectaculaire : observer ses déplacements avant le centre explique une grande part de la menace.",
   mechanism:"Pour le comprendre, il faut lire le pied du centreur, la hauteur de la ligne adverse et le nombre d'appuis dont dispose Ronaldo pour déclencher son appel. Un centre tardif sur défense placée n'offre pas le même contexte qu'une attaque rapide face à une charnière reculant.",
   withoutBall:"La valeur d'un avant-centre peut se voir au moment où il attire deux défenseurs centraux et libère la zone du point de penalty pour un coéquipier. Ce mouvement peut être décisif sans contact avec le ballon.",
   keyDuel:"Centres aériens contre bloc dense : l'équipe doit fournir des trajectoires exploitables, pas seulement multiplier les ballons hauts. Comparer ballons touchés dans la surface et volume de centres évite de surévaluer une domination stérile.",
   vulnerability:"Quand l'adversaire contrôle la largeur et coupe l'alimentation de la surface, le nombre d'occasions franches peut baisser même si l'équipe possède davantage le ballon. L'analyse doit séparer le prestige du nom et la qualité réelle du service.",
   angle:"Le vrai débat n'est pas le nombre de vidéos virales mais la fréquence des positions de finition obtenues face à des défenses différentes.",
   comparison:"Comparé à un attaquant qui décroche pour organiser le jeu, Ronaldo demande davantage à ses partenaires de fabriquer la dernière passe dans une zone très précise.",
   observation:"Relever la proportion de centres trouvant un partenaire, les courses premier/second poteau et les tirs pris dans les six mètres.",
   image:"/blog/discover/inline-goal.jpg"},
  {name:"Neymar",slug:"neymar",rank:2,monthly:5066667,nation:"Brésil",
   archetype:"créateur en un contre un et aimant à défenseurs",
   profile:"Neymar a longtemps incarné le dribble comme moyen de créer un déséquilibre plutôt que comme fin en soi. Le défenseur qui sort à sa rencontre ouvre un angle de passe ; celui qui reste en place lui laisse le temps de conduire. L'intérêt tactique tient à cette double menace.",
   mechanism:"L'enchaînement contrôle orienté, feinte, fixation puis remise peut déplacer deux adversaires d'un seul côté. Une passe courte après le duel crée parfois une occasion plus dangereuse qu'une tentative de frappe directe.",
   withoutBall:"Même sans toucher le ballon, sa position entre latéral et milieu peut contraindre l'adversaire à resserrer le bloc et ouvrir le couloir opposé. Lire le rôle des joueurs autour de lui est indispensable.",
   keyDuel:"Un contre un face au latéral soutenu par un second défenseur : le choix décisif est souvent de relâcher au bon moment plutôt que d'insister jusqu'à perdre le ballon.",
   vulnerability:"Les pertes dans l'axe, les densités défensives et la continuité physique modifient l'impact potentiel d'un dribbleur. Ni les compilations de gestes ni la célébrité n'indiquent la disponibilité du jour.",
   angle:"Mesurer la valeur de la fixation avant la passe décisive : une action peut être structurante sans apparaître dans le compteur de buts.",
   comparison:"À l'inverse d'un finisseur de surface, Neymar crée surtout en attirant la pression vers le ballon, avant de choisir la sortie.",
   observation:"Noter le nombre de défenseurs mobilisés, les passes qui suivent une fixation et la progression vers la surface.",
   image:"/blog/discover/inline-action.jpg"},
  {name:"Lionel Messi",slug:"lionel-messi",rank:3,monthly:3276667,nation:"Argentine",
   archetype:"créateur entre les lignes et accélérateur de décisions",
   profile:"L'action de Messi se lit d'abord dans les espaces intermédiaires. Il peut recevoir sans être exactement sur l'aile ni en pointe, orienter un contrôle et transformer quelques mètres libres en passe dans le dos de la ligne défensive.",
   mechanism:"Le temps d'avance vient de la lecture du bloc adverse avant la réception. Quand un milieu hésite à sortir sur lui, le défenseur suivant doit souvent arbitrer entre protéger sa profondeur et avancer ; cet instant nourrit sa créativité.",
   withoutBall:"Ses déplacements discrets dans le demi-espace peuvent déplacer un milieu récupérateur et préparer la passe du partenaire. Le suivi du ballon seul manque donc une partie de l'action.",
   keyDuel:"Face à un bloc compact, le premier contrôle et la passe verticale comptent plus que la vitesse de course maximale. Observer l'intervalle choisi entre deux adversaires.",
   vulnerability:"Sans profondeur offerte par les appels autour de lui, l'équipe peut recycler le ballon latéralement. Le meneur ne remplace pas le mouvement collectif.",
   angle:"Pourquoi quelques touches peuvent produire plus de désorganisation qu'une longue possession.",
   comparison:"Là où un attaquant cherche d'abord la dernière position de tir, Messi peut générer l'avantage une ou deux passes avant la finition.",
   observation:"Observer les réceptions dans le demi-espace, passes cassant une ligne et occasions créées après contrôle orienté.",
   image:"/blog/discover/inline-shot.jpg"},
  {name:"Kylian Mbappé",slug:"kylian-mbappe",rank:4,monthly:3132500,nation:"France",
   archetype:"ruptures dans la profondeur et attaques du couloir gauche",
   profile:"Mbappé transforme l'espace situé derrière la défense en menace permanente. Son principal levier n'est pas uniquement la vitesse de pointe, mais le moment où il initie sa course pendant que le passeur peut encore lever la tête.",
   mechanism:"Face à un bloc haut, un simple décalage de la ligne défensive crée le couloir d'accélération. Devant une défense regroupée, les appels doivent être courts ou combinés avec un joueur de fixation : la même course ne fonctionne pas dans les deux contextes.",
   withoutBall:"Sa présence impose au latéral une question permanente : suivre vers l'intérieur ou rester à la largeur. Cette hésitation peut créer une situation de deux contre un avant même son premier contact.",
   keyDuel:"Latéral avancé contre course diagonale : la qualité de la passe dans le dos décide si la vitesse devient occasion ou hors-jeu.",
   vulnerability:"Un bloc bas resserré et une couverture précoce limitent la profondeur. Il faut alors juger le jeu combiné, les appels inversés et la variété des tirs, plutôt que d'attendre un sprint spectaculaire.",
   angle:"Expliquer pourquoi profondeur disponible, hors-jeu et timing pèsent plus que les seuls kilomètres par heure.",
   comparison:"Mbappé attaque prioritairement un espace libre ; un créateur comme Messi peut être à l'origine de la passe qui fabrique cet espace.",
   observation:"Mesurer les courses dans le dos de la ligne, ballons reçus face au but et déclenchements entre deux défenseurs.",
   image:"/blog/discover/inline-live.jpg"},
  {name:"Raphinha",slug:"raphinha",rank:5,monthly:2012500,nation:"Brésil",
   archetype:"ailier agressif, courses intérieures et pressing",
   profile:"Raphinha associe le travail d'ailier à la pression collective. Son intérêt tactique se voit dans la répétition des courses sans ballon, les attaques du deuxième poteau et les pressings qui enferment le relanceur vers une zone déterminée.",
   mechanism:"Quand un latéral se rapproche pour protéger le couloir, la course intérieure libère un espace pour le dédoublement. À l'inverse, rester large permet d'étirer le bloc et de créer une ligne de passe vers le milieu.",
   withoutBall:"Le pressing d'un ailier ne consiste pas à courir partout : il doit fermer un angle de relance et synchroniser sa pression avec le milieu. C'est une action collective mesurable.",
   keyDuel:"Repli défensif contre montée du latéral : comprendre à quel moment Raphinha quitte le couloir pour terminer l'action au second poteau.",
   vulnerability:"La disponibilité des espaces et le soutien du latéral conditionnent sa créativité. Un pressing individuel isolé peut aussi ouvrir une voie de passe dans son dos.",
   angle:"Comment associer occasions construites et travail défensif pour lire un ailier moderne.",
   comparison:"Contrairement au dribbleur qui cherche d'abord à attirer un second défenseur, Raphinha peut créer un avantage par la course opposée au ballon.",
   observation:"Suivre les récupérations hautes collectives, courses second poteau et changements de couloir après pressing.",
   image:"/blog/discover/inline-packed.jpg"},
  {name:"Arda Güler",slug:"arda-guler",rank:6,monthly:2001667,nation:"Turquie",
   archetype:"gaucher créatif, passes entre les lignes et variation du tempo",
   profile:"Arda Güler attire l'attention par sa qualité de pied gauche et sa volonté de trouver une solution verticale. Pour lire son football, il faut distinguer une passe qui traverse le bloc d'une passe simplement propre à proximité du ballon.",
   mechanism:"Dans un demi-espace droit, l'orientation du corps ouvre la possibilité d'une frappe enroulée ou d'un service vers l'intérieur. Cette ambiguïté force le défenseur à choisir une ligne de protection.",
   withoutBall:"Un repositionnement de quelques pas peut offrir un angle de passe au porteur et éviter une relance forcée sur le latéral sous pression.",
   keyDuel:"Milieu créatif face à une sentinelle : un contrôle permettant de jouer immédiatement vers l'avant vaut parfois davantage qu'une conduite de balle supplémentaire.",
   vulnerability:"Une équipe qui ne propose pas d'appels derrière la défense réduit la valeur des passes créatives. Il faut aussi distinguer influence à la construction et occasions directement conclues.",
   angle:"Ce que révèle le pied gauche d'un créateur sur la manière de défendre une zone, sans réduire toute son analyse à sa technique.",
   comparison:"Face à un ailier de profondeur comme Mbappé, Güler incarne davantage le geste de connexion qui met le partenaire en mouvement.",
   observation:"Regarder passes verticales, orientations avant réception et duels gagnés sans faute dans le demi-espace.",
   image:"/blog/discover/inline-aerial.jpg"},
  {name:"Harry Kane",slug:"harry-kane",rank:7,monthly:1744417,nation:"Angleterre",
   archetype:"avant-centre organisateur, remise et finition",
   profile:"Kane illustre le numéro neuf capable de devenir passeur. En décrochant devant la charnière, il attire un défenseur, reçoit dos au but et peut remettre vers un partenaire lancé à pleine vitesse.",
   mechanism:"La qualité de ses remises change la structure de l'attaque : le centre de gravité du jeu se déplace vers le milieu et ouvre parfois un espace libéré par le central sorti de sa zone.",
   withoutBall:"Les appels autour de Kane sont déterminants. Si les ailiers ne plongent pas lorsque le neuf décroche, la remise conserve le ballon mais ne brise aucune ligne.",
   keyDuel:"Défenseur central face à un neuf qui décroche : le choix de suivre ou de transmettre le marquage crée un risque différent pour le bloc.",
   vulnerability:"Sans courses coordonnées autour de lui, une équipe peut ajouter de la possession sans gagner de profondeur. Les tirs et passes décisives doivent être lus avec le mouvement des partenaires.",
   angle:"Pourquoi un attaquant peut être essentiel même lorsqu'il ne termine pas l'action.",
   comparison:"Kane contraste avec Ronaldo : il peut fabriquer l'avant-dernière passe là où un avant-centre de fixation privilégie le dernier geste.",
   observation:"Relever remises en une touche, passes vers joueurs lancés et fréquence des décrochages utiles.",
   image:"/blog/discover/inline-night.jpg"},
  {name:"Jude Bellingham",slug:"jude-bellingham",rank:8,monthly:1626667,nation:"Angleterre",
   archetype:"milieu polyvalent, courses tardives et occupation de surface",
   profile:"Bellingham se distingue par son aptitude à lier plusieurs zones du terrain. Son rôle peut évoluer entre récupération, progression et arrivée dans la surface ; la lecture exige donc de suivre ses déplacements plutôt qu'une étiquette de poste.",
   mechanism:"L'appel depuis la deuxième ligne surprend davantage lorsqu'un attaquant fixe déjà les centraux. Le timing, plus que la simple distance parcourue, permet d'attaquer la zone libérée.",
   withoutBall:"L'équilibre de l'équipe dépend de qui couvre l'espace qu'il abandonne quand il se projette. Une course offensive utile peut devenir dangereuse en transition défensive si le relais manque.",
   keyDuel:"Milieu box-to-box contre sentinelle : observer qui gagne la position avant la passe et qui défend l'intervalle au retour.",
   vulnerability:"Le volume de courses ne garantit pas la lucidité dans la dernière décision. Le contexte tactique peut aussi imposer un rôle plus prudent.",
   angle:"Pourquoi la polyvalence d'un milieu s'évalue avec la couverture collective, pas seulement les buts.",
   comparison:"Bellingham recherche parfois l'espace d'arrivée derrière l'attaquant ; Güler privilégie souvent le ballon qui rend cette arrivée possible.",
   observation:"Compter les entrées dans la surface venant de la deuxième ligne, couvertures en transition et duels avant possession.",
   image:"/blog/discover/inline-crowd.jpg"},
  {name:"Viktor Gyökeres",slug:"viktor-gyokeres",rank:9,monthly:1621250,nation:"Suède",
   archetype:"avant-centre puissant, appels et conduite vers le but",
   profile:"Gyökeres mêle force de progression et attaques directes de l'axe. Pour comprendre son efficacité, il faut analyser sa capacité à recevoir malgré le contact puis à orienter sa course vers le but avant la fermeture du second défenseur.",
   mechanism:"Une conduite physique réussie change l'angle de tir et oblige l'arrière-garde à choisir entre sortir trop tôt ou reculer. Le contexte du contre rapide lui offre d'autres options qu'une défense déjà installée.",
   withoutBall:"Sa disponibilité comme appui peut faire remonter le bloc. La qualité de la deuxième vague dépend alors des milieux qui récupèrent sa remise.",
   keyDuel:"Un contre un dans le couloir intérieur : la première touche et la protection du ballon conditionnent la possibilité de finir sans laisser le deuxième central intervenir.",
   vulnerability:"Les défenses compactes réduisent l'espace de conduite. Plus qu'un total brut de tirs, il faut mesurer combien viennent d'angles réellement favorables.",
   angle:"Ce que la puissance d'un attaquant change dans la transition offensive, sans la confondre avec une garantie de but.",
   comparison:"À la différence du décrochage organisateur de Kane, Gyökeres peut chercher à gagner immédiatement du terrain par la conduite et le duel.",
   observation:"Suivre les mètres gagnés avant la frappe, duels de fixation, tirs sous pression et appuis réussis.",
   image:"/blog/discover/inline-pitch.jpg"},
  {name:"Endrick",slug:"endrick",rank:10,monthly:1547167,nation:"Brésil",
   archetype:"attaquant explosif, première intention et déplacements courts",
   profile:"Endrick représente l'intérêt du jeune finisseur qui cherche vite le but. Les observateurs doivent regarder la préparation de la frappe, la façon dont il protège le ballon dans un espace réduit et le choix entre tirer immédiatement ou conserver.",
   mechanism:"Un bon déplacement latéral à l'intérieur de la surface peut suffire à ouvrir une fenêtre de tir. Le placement du défenseur et la vitesse de transmission comptent autant que la force de frappe.",
   withoutBall:"Les appels courts derrière l'épaule du central peuvent créer une séparation de quelques dizaines de centimètres, parfois suffisante pour une finition en première touche.",
   keyDuel:"Attaquant face à une charnière bien alignée : repérer la prise d'information avant l'appel et le choix du pied de finition.",
   vulnerability:"L'échantillon de matchs et le temps de jeu influencent fortement toute comparaison avec des vétérans. Une moyenne par 90 minutes sur peu d'actions ne raconte pas toute l'histoire.",
   angle:"Comment mesurer une progression sans transformer chaque action d'un jeune joueur en verdict définitif.",
   comparison:"Face à Ronaldo, finisseur aux habitudes très documentées, Endrick invite à distinguer potentiel observé et régularité établie.",
   observation:"Noter contrôles avant tir, séparation créée par appel court et qualité du choix entre tir et remise.",
   image:"/blog/discover/inline-ball.jpg"}
];

const SUBJECTS = [
 {suffix:"",title:"portrait, parcours et grands moments",tag:"Sa vie et sa carrière"},
 {suffix:"style-de-jeu",title:"pourquoi son football plaît tant aux supporters",tag:"Sa façon de jouer"},
 {suffix:"statistiques",title:"buts, records et trophées expliqués simplement",tag:"Buts et trophées"},
 {suffix:"duels-et-limites",title:"ses plus beaux souvenirs et ses moments difficiles",tag:"Les moments forts et les épreuves"},
] as const;

function addTime(days:number): string { return new Date(START + days * 24*60*60*1000).toISOString(); }
export function publicationAt(p:Player): string { return addTime((p.rank - 1) * 2); }
export function publicPlayers(now=Date.now()): Player[] {
 return PLAYER_PROFILES.filter((p)=>Date.parse(publicationAt(p))<=now);
}
/** Public-facing stories are about people first: formative years, clubs, famous games, feelings, concrete trophies.
 * Four genuinely differentiated editorial reads rather than four near-duplicate SEO-method articles. */
export function allPlayerCocoonArticles(): BlogArticle[] {
 return PLAYER_PROFILES.flatMap((p)=> {
  const bio=PLAYER_BIOGRAPHIES[p.slug];
  if (!bio) throw new Error("PLAYER_BIOGRAPHY_MISSING: "+p.slug);
  const published=publicationAt(p), cluster="joueur-"+p.slug;
  const hubSlug=p.slug+"-portrait-2026";
  const paths=SUBJECTS.map((subject)=> subject.suffix ? p.slug+"-"+subject.suffix+"-2026" : hubSlug);
  const articles:BlogArticle[]=SUBJECTS.map((subject,i)=>{
    const h1=i===0 ? p.name+" : son histoire, ses clubs et ses grands moments" : p.name+" : "+subject.title;
    const lead=[
      "De ses débuts à ses plus grands matches, découvrez l'histoire de "+p.name+", les clubs qui ont changé sa vie, ses grandes victoires et ses moments difficiles. Un portrait raconté simplement.",
      "Pourquoi aime-t-on regarder jouer "+p.name+" ? Ses gestes préférés, les actions dont les supporters se souviennent et ce qu'il apporte à son équipe, sans jargon.",
      "Quels titres et quels buts ont marqué la carrière de "+p.name+" ? Voici les chiffres historiques et les grandes victoires, avec leurs dates et leurs sources.",
      "Les grandes joies, les finales, les blessures ou les doutes : retour sur les moments qui ont fait grandir "+p.name+" et sur ce qui passionne ses supporters."
    ][i];
    // Each article has its own intent. Main article covers the whole life story; children explore different chapters.
    const paragraphs:BlogArticle["paragraphs"]=i===0 ? [
      {h2:"Qui est "+p.name+" et d'où vient-il ?",body:bio.born},
      {h2:"Ses premiers clubs : comment tout a commencé",body:bio.journey},
      {h2:"L'aventure qui l'a rendu célèbre",body:bio.clubStory},
      {h2:"Le match ou la soirée que les fans n'oublient pas",body:bio.memorable},
      {h2:"Ce qu'il a vécu avec "+(p.nation==="Brésil"?"le Brésil":p.nation==="France"?"les Bleus":p.nation==="Angleterre"?"l'Angleterre":p.nation==="Portugal"?"le Portugal":p.nation==="Argentine"?"l'Argentine":p.nation==="Turquie"?"la Turquie":p.nation==="Suède"?"la Suède":"sa sélection"),body:bio.international},
      {h2:"Un homme et un caractère derrière les buts",body:bio.character},
      {h2:"Pourquoi son histoire intéresse encore les supporters",body:bio.perspective},
      {h2:"Pourquoi ce joueur figure dans notre série",body:"Une étude internationale sur les recherches Google, publiée en juin 2026, mentionne "+p.name+" parmi dix footballeurs très recherchés. Il s'agit d'une moyenne historique, pas d'un classement des recherches d'aujourd'hui. La célébrité explique le choix du sujet ; elle ne prouve pas qu'il est actuellement le meilleur joueur. Nous avons privilégié son parcours et ses vrais grands matches pour raconter autre chose qu'un nom populaire."}
    ] : i===1 ? [
      {h2:"Ce qu'on aime voir quand "+p.name+" joue",body:bio.football},
      {h2:"Comment il a appris à jouer de cette manière",body:bio.journey},
      {h2:"Un grand match qui montre son talent",body:bio.memorable},
      {h2:"Ce qui le rend différent des autres joueurs",body:bio.character},
      {h2:"Pourquoi son jeu fait parler dans les tribunes",body:bio.perspective}
    ] : i===2 ? [
      {h2:"Ses buts et ses chiffres les plus connus",body:bio.numbers},
      {h2:"Les trophées qu'il a vraiment gagnés",body:bio.trophies},
      {h2:"Le chemin suivi pour atteindre ces titres",body:bio.clubStory},
      {h2:"Les grandes compétitions avec son pays",body:bio.international},
      {h2:"Ce que les statistiques ne racontent pas de lui",body:bio.character}
    ] : [
      {h2:"La soirée qui a marqué sa carrière",body:bio.memorable},
      {h2:"Les blessures, les défaites ou la pression",body:bio.difficulties},
      {h2:"Comment sa carrière a pris un autre chemin",body:bio.journey},
      {h2:"Sa relation avec les supporters",body:bio.character},
      {h2:"Ce qu'il reste à écrire dans son histoire",body:bio.perspective}
    ];
    const question=i===0?"D'où vient "+p.name+" ?":i===1?"Qu'est-ce qui rend "+p.name+" intéressant à regarder ?":i===2?"Quels sont les chiffres historiques de "+p.name+" ?":"Quels événements ont changé la carrière de "+p.name+" ?";
    const answer=i===0?bio.born:i===1?bio.football:i===2?bio.numbers:bio.memorable;
    return {
      slug:paths[i],h1,title:h1+" | BetGPT",lead,
      keywords:[p.name,p.slug,subject.title,"parcours footballeur","biographie football"].join(", "),
      section:"Portraits de footballeurs",published,releaseAt:published,cluster,
      // The pillar enters existing RSS and discovery infrastructure as the topical release.
      isNews:i===0,cover:p.image,
      paragraphs,
      faq:[
        {q:question,a:answer},
        {q:"Où retrouver les grands moments et les titres de "+p.name+" ?",a:"Ce dossier comprend quatre articles complémentaires : son histoire, sa façon de jouer, ses records et ses moments marquants. Les principaux faits sont recoupés avec les pages officielles des clubs, de l'UEFA ou de la FIFA."},
      ],
      links:[
        ...paths.filter((slug)=>slug!==paths[i]).map((slug)=>({
           href:"/blog/"+slug,
           label: slug===hubSlug ? "Portrait complet de "+p.name : p.name+" — "+SUBJECTS[paths.indexOf(slug)].tag
        })),
        ...bio.sources,
        {href:PLAYER_RANKING_SOURCE,label:"Pourquoi ce joueur : étude Google publiée en juin 2026"},
        {href:"/scores-en-direct",label:"Suivre les matchs et résultats de football"}
      ],
    };
  });
  return articles;
 });
}

export function releasedPlayerCocoonArticles(now=Date.now()): BlogArticle[] {
 return allPlayerCocoonArticles().filter((a)=>Date.parse(a.releaseAt||"")<=now);
}
