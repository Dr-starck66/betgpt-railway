import type { ArticleType, EditorialImage, LeagueId } from "@/lib/editorial/types";

/**
 * Photos déjà recadrées en 1200×675, licences Unsplash / Pexels (public/blog/CREDITS.txt).
 * Ce sont des illustrations, jamais présentées comme la photo du match.
 */
const POOL: { src: string; alt: string; leagues?: LeagueId[] }[] = [
  { src: "/blog/discover/inline-night.jpg", alt: "Stade de football éclairé la nuit", leagues: ["CL", "EL"] },
  { src: "/blog/discover/inline-flags.jpg", alt: "Public et drapeaux dans un stade", leagues: ["NL"] },
  { src: "/blog/discover/inline-crowd.jpg", alt: "Tribunes d'un stade de football", leagues: ["L1", "PL"] },
  { src: "/blog/discover/inline-action.jpg", alt: "Joueurs de football en action", leagues: ["LL", "SA"] },
  { src: "/blog/discover/inline-shot.jpg", alt: "Frappe au but pendant un match", leagues: ["BL"] },
  { src: "/blog/discover/inline-aerial.jpg", alt: "Pelouse de stade vue du dessus" },
  { src: "/blog/discover/inline-pitch.jpg", alt: "Ballon sur une pelouse de football" },
  { src: "/blog/discover/inline-live.jpg", alt: "Supporters pendant un match de football" },
  { src: "/blog/discover/score-en-direct-ligue-1.jpg", alt: "Ambiance de match de football", leagues: ["L1"] },
  { src: "/blog/discover/pronostic-ligue-des-champions.jpg", alt: "Stade avant une soirée de football", leagues: ["CL"] },
  { src: "/blog/discover/pronostic-ligue-europa.jpg", alt: "Pelouse et stade de football", leagues: ["EL"] },
  { src: "/blog/discover/xg-en-direct.jpg", alt: "Action de jeu sur un terrain de football" },
];

const CREDIT = "Football : actualités, contexte et analyse sur BetGPT.";

export function hashKey(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return h;
}

export function pickImage(key: string, league: LeagueId | null, used: Set<string>): EditorialImage {
  const preferred = POOL.filter((item) => !used.has(item.src) && league && item.leagues?.includes(league));
  const rest = POOL.filter((item) => !used.has(item.src));
  const bag = preferred.length ? preferred : rest.length ? rest : POOL;
  const choice = bag[hashKey(key) % bag.length]!;
  used.add(choice.src);
  return {
    src: choice.src,
    alt: choice.alt,
    width: 1200,
    height: 675,
    credit: CREDIT,
  };
}

export function imageFor(type: ArticleType, league: LeagueId | null, slug: string, used: Set<string>): EditorialImage {
  return pickImage(`${type}:${league ?? "x"}:${slug}`, league, used);
}
