import type { EditorialImage, EditorialParagraph } from "./types.ts";

/**
 * Source-checked archive photos for one verified football event. This is not a
 * general-purpose image pool: other topics must fail closed until their own
 * per-file rights and subject relevance have been established.
 *
 * Metadata independently checked against the Wikimedia Commons file pages on
 * 2026-10-28. Images are archival illustrations, NOT photos of the 2026 game.
 * Runtime/deployment checks must still establish that the bytes are served.
 */
const BAYERN_REAL_WOMEN_20261028: readonly EditorialImage[] = [
  {
    src: "https://upload.wikimedia.org/wikipedia/commons/a/a3/19980607_Sportpark_Unterhaching.JPG",
    width: 1498, height: 1013,
    alt: "Vue historique du stade Am Sportpark à Unterhaching, enceinte du Bayern–Real Madrid féminin",
    caption: "Le Sportpark d’Unterhaching sur une photographie d’archive de 1998. Cette image ne représente pas la rencontre du 28 octobre 2026.",
    credit: "Northside / Wikimedia Commons, CC BY-SA 3.0 ; photographie non modifiée.",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:19980607_Sportpark_Unterhaching.JPG",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
  },
  {
    src: "https://upload.wikimedia.org/wikipedia/commons/1/1c/Stade_Santiago_Bernabeu_04.jpg",
    width: 6546, height: 3820,
    alt: "Vue intérieure du stade Santiago Bernabéu à Madrid, illustration du club du Real Madrid",
    caption: "Le stade Santiago Bernabéu à Madrid en 2022, photographie d’archive du club visiteur. Le match féminin du 28 octobre 2026 s’est joué à Unterhaching, pas ici.",
    credit: "Zakarie Faibis / Wikimedia Commons, CC BY-SA 4.0 ; photographie non modifiée.",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Stade_Santiago_Bernabeu_04.jpg",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  },
];

function mentionsClubs(text: string): boolean {
  const normalized = text.toLocaleLowerCase("fr").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return /bayern/.test(normalized) && /real madrid/.test(normalized);
}

function mentionsWomen(text: string): boolean {
  const normalized = text.toLocaleLowerCase("fr").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return /feminin|women|frauen|womens|wcl/.test(normalized);
}

/** Assign two different, source-relevant photos to different H2 sections only. */
export function attachVerifiedInlineImages(
  paragraphs: EditorialParagraph[],
  title: string,
  sourceTitles: string[],
  parisDay: string,
): EditorialParagraph[] {
  const safeCopy = paragraphs.map((part) => ({ ...part }));
  if (parisDay !== "2026-10-28" || safeCopy.length < 7 || !mentionsClubs(title)) return safeCopy;
  const supporting = sourceTitles.filter((source) => mentionsClubs(source) && mentionsWomen(source));
  if (supporting.length < 2) return safeCopy;
  // The match venue and the visiting club are illustrated in separate sections.
  // A cover image is assigned independently by imageFor(), never reused here.
  safeCopy[1] = { ...safeCopy[1]!, inlineImage: { ...BAYERN_REAL_WOMEN_20261028[0]! } };
  safeCopy[4] = { ...safeCopy[4]!, inlineImage: { ...BAYERN_REAL_WOMEN_20261028[1]! } };
  return safeCopy;
}
