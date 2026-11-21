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

/** Individually verified Commons archives for Arsenal–Benfica women (28 Oct 2026).
 * These depict Russo in 2024 and Meadow Park in 2022, not the 2026 match. */
const ARSENAL_BENFICA_WOMEN_20261029: readonly EditorialImage[] = [
  {
    src: "https://upload.wikimedia.org/wikipedia/commons/9/9c/Valerenga-Arsenal_WUCL_12-12-2024_CG3A4421_05.jpg",
    width: 4480, height: 2986,
    alt: "Alessia Russo avec Arsenal face à Vålerenga en Ligue des champions féminine en décembre 2024",
    caption: "Alessia Russo avec Arsenal contre Vålerenga le 12 décembre 2024 : archive, pas le match face à Benfica du 28 octobre 2026.",
    credit: "MichaelEmilio / Wikimedia Commons, CC BY 4.0 ; photographie non modifiée.",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Valerenga-Arsenal_WUCL_12-12-2024_CG3A4421_05.jpg",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  },
  {
    src: "https://upload.wikimedia.org/wikipedia/commons/8/8f/Meadow_Park_Stadium%2C_Borehamwood_-_geograph.org.uk_-_7273530.jpg",
    width: 1920, height: 1280,
    alt: "Vue extérieure de Meadow Park à Borehamwood, stade du match Arsenal féminin contre Benfica",
    caption: "Vue extérieure de Meadow Park à Borehamwood en septembre 2022 : archive du stade, pas du match du 28 octobre 2026.",
    credit: "David Howard / Geograph / Wikimedia Commons, CC BY-SA 2.0 ; photographie non modifiée.",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Meadow_Park_Stadium,_Borehamwood_-_geograph.org.uk_-_7273530.jpg",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/",
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
  if (safeCopy.length < 7) return safeCopy;
  const normalizedTitle = title.toLocaleLowerCase("fr").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (parisDay === "2026-10-29" && /arsenal/.test(normalizedTitle) && /benfica/.test(normalizedTitle)) {
    const supporting = sourceTitles.filter((source) => /arsenal/i.test(source) && /benfica/i.test(source) && mentionsWomen(source));
    if (supporting.length < 2) return safeCopy;
    safeCopy[1] = { ...safeCopy[1]!, inlineImage: { ...ARSENAL_BENFICA_WOMEN_20261029[0]! } };
    safeCopy[4] = { ...safeCopy[4]!, inlineImage: { ...ARSENAL_BENFICA_WOMEN_20261029[1]! } };
    return safeCopy;
  }
  if (parisDay !== "2026-10-28" || safeCopy.length < 7 || !mentionsClubs(title)) return safeCopy;
  const supporting = sourceTitles.filter((source) => mentionsClubs(source) && mentionsWomen(source));
  if (supporting.length < 2) return safeCopy;
  // The match venue and the visiting club are illustrated in separate sections.
  // A cover image is assigned independently by imageFor(), never reused here.
  safeCopy[1] = { ...safeCopy[1]!, inlineImage: { ...BAYERN_REAL_WOMEN_20261028[0]! } };
  safeCopy[4] = { ...safeCopy[4]!, inlineImage: { ...BAYERN_REAL_WOMEN_20261028[1]! } };
  return safeCopy;
}
