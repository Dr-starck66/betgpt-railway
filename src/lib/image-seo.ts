import { logoFor } from "@/lib/crests";
import { SITE_URL, slugify } from "@/lib/programmatic";

/** Contrat unique : toute image du site (présente ou à venir) a alt, title, description, nom de fichier. */
export type ImageSeo = {
  src: string;
  alt: string;
  title: string;
  description: string;
  filename: string;
  caption: string;
  width?: number;
  height?: number;
};

export const BRAND_LOGO: ImageSeo = {
  src: "/logo-betgpt-pronostics-football.png",
  alt: "Logo BetGPT — pronostics football et cotes France",
  title: "BetGPT, desk de pronostics football",
  description:
    "Logo de BetGPT, site français de pronostics football, scores en direct et comparaison de cotes Unibet, Betclic, NetBet.",
  filename: "logo-betgpt-pronostics-football.png",
  caption: "BetGPT — pronostics football",
  width: 512,
  height: 512,
};

export const BRAND_OG: ImageSeo = {
  src: "/og-betgpt-pronostics-cotes-football.jpg",
  alt: "BetGPT — bureau de pronostics football, cotes France et scores en direct",
  title: "Pronostics football et meilleures cotes | BetGPT",
  description:
    "Image de partage BetGPT : pronostics football du jour, value bets, scores en direct et cotes des bookmakers français.",
  filename: "og-betgpt-pronostics-cotes-football.jpg",
  caption: "Desk BetGPT : pronostics, cotes, live",
  width: 1200,
  height: 630,
};

export const BRAND_HERO: ImageSeo = {
  src: "/hero-desk-paris-football-betgpt.jpg",
  alt: "Desk BetGPT — analyse des matchs de football et des cotes",
  title: "Bureau BetGPT, pronostics et value bets",
  description:
    "Le bureau BetGPT : calendrier réel, pronostic 1N2, meilleures cotes France, scores en direct.",
  filename: "hero-desk-paris-football-betgpt.jpg",
  caption: "Le desk BetGPT",
  width: 1200,
  height: 675,
};

export const LEGAL_ANJ: ImageSeo = {
  src: "/legal/interdiction-moins-18-ans-anj-jeu-responsable.png",
  alt: "Gouvernement français — interdit aux moins de 18 ans, jeu responsable ANJ",
  title: "Interdit aux mineurs — jeu responsable ANJ | BetGPT",
  description:
    "Bandeau légal : interdiction des jeux d’argent aux moins de 18 ans, mentions ANJ, Joueurs Info Service 09 74 75 13 13.",
  filename: "interdiction-moins-18-ans-anj-jeu-responsable.png",
  caption: "Interdit aux moins de 18 ans",
  width: 250,
  height: 107,
};

export function absImg(src: string): string {
  if (!src) return `${SITE_URL}${BRAND_OG.src}`;
  return src.startsWith("http") ? src : `${SITE_URL}${src}`;
}

export function crestFilename(name: string): string {
  return `ecusson-${slugify(name)}-logo-club-football.png`;
}

export function crestSeo(
  name: string,
  opts?: { competition?: string; size?: number; id?: string; logo?: string },
): ImageSeo {
  const src = logoFor(name, opts?.id, opts?.logo) ?? "";
  const competition = opts?.competition;
  return {
    src,
    alt: competition ? `Écusson ${name} — club de ${competition}` : `Écusson ${name} — logo du club de football`,
    title: `Logo ${name} | BetGPT`,
    description: `Écusson officiel de ${name}${competition ? `, club de ${competition}` : ""}. Pronostic, cotes France et calendrier sur BetGPT.`,
    filename: crestFilename(name),
    caption: `Logo ${name}`,
    width: opts?.size ?? 32,
    height: opts?.size ?? 32,
  };
}

export function blogImageSeo(src: string, alt: string, caption: string): ImageSeo {
  const filename = src.split("/").pop() ?? "image-football-betgpt.jpg";
  const cleanAlt = String(alt || "").replace(/\s+/g, " ").trim();
  const cleanCaption = String(caption || "").replace(/\s+/g, " ").trim();
  return {
    src,
    alt: cleanAlt,
    title: cleanAlt,
    description: cleanCaption,
    filename,
    caption: cleanCaption,
    width: 1200,
    height: 675,
  };
}

export function imageObjectLd(img: ImageSeo, pageUrl?: string): Record<string, unknown> {
  const url = absImg(img.src || BRAND_OG.src);
  return {
    "@type": "ImageObject",
    contentUrl: url,
    url,
    name: img.filename,
    alternateName: img.alt,
    description: img.description,
    caption: img.caption,
    encodingFormat: img.filename.endsWith(".png")
      ? "image/png"
      : img.filename.endsWith(".webp")
        ? "image/webp"
        : img.filename.endsWith(".svg")
          ? "image/svg+xml"
          : "image/jpeg",
    width: img.width,
    height: img.height,
    inLanguage: "fr-FR",
    creditText: /espncdn/.test(img.src) ? "ESPN" : "BetGPT",
    ...(pageUrl ? { isPartOf: pageUrl } : {}),
  };
}

export function imageHeadTags(img: ImageSeo): { property?: string; name?: string; content: string }[] {
  const url = absImg(img.src);
  const type = img.filename.endsWith(".png") ? "image/png" : "image/jpeg";
  return [
    { property: "og:image", content: url },
    { property: "og:image:alt", content: img.alt },
    { property: "og:image:width", content: String(img.width ?? 1200) },
    { property: "og:image:height", content: String(img.height ?? 630) },
    { property: "og:image:type", content: type },
    { name: "twitter:image", content: url },
    { name: "twitter:image:alt", content: img.alt },
  ];
}
