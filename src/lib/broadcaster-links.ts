export type BroadcasterSpec = {
  key: string;
  label: string;
  officialUrl: string;
  affiliateUrl?: string;
  affiliateProgram?: {
    network: string;
    programUrl: string;
    verifiedAt: string;
  };
  patterns: string[];
};

export type BroadcasterLink = {
  key: string;
  label: string;
  text: string;
  href: string;
  sponsored: boolean;
};

export type BroadcasterToken =
  | { kind: "text"; text: string }
  | ({ kind: "link" } & BroadcasterLink);

/**
 * Source unique de vérité pour les diffuseurs.
 * Aujourd'hui, officialUrl pointe vers le site officiel.
 * Demain, renseigner affiliateUrl ici suffit pour basculer toutes les surfaces BetGPT.
 */
export const BROADCASTERS: BroadcasterSpec[] = [
  { key: "bein-sports", label: "beIN SPORTS", officialUrl: "https://www.beinsports.com/fr-fr", patterns: ["beIN\\s+SPORTS(?:\\s+(?:MAX\\s+)?\\d+)?"] },
  { key: "dazn", label: "DAZN", officialUrl: "https://www.dazn.com/fr-FR/home", affiliateProgram: { network: "Awin", programUrl: "https://ui.awin.com/merchant-profile/126261", verifiedAt: "2026-10-02" }, patterns: ["DAZN(?:\\s+\\d+)?"] },
  { key: "canal-plus", label: "CANAL+", officialUrl: "https://www.canalplus.com/", patterns: ["CANAL\\+(?:\\s+(?:FOOT|SPORT(?:\\s+360)?|LIVE(?:\\s+\\d+)?))?"] },
  { key: "tf1", label: "TF1", officialUrl: "https://www.tf1.fr/", patterns: ["TF1(?:\\+)?"] },
  { key: "tmc", label: "TMC", officialUrl: "https://www.tf1.fr/tmc", patterns: ["TMC"] },
  { key: "m6", label: "M6", officialUrl: "https://www.m6.fr/", patterns: ["M6(?:\\+)?"] },
  { key: "w9", label: "W9", officialUrl: "https://www.6play.fr/w9", patterns: ["W9"] },
  { key: "france-tv", label: "France Télévisions", officialUrl: "https://www.france.tv/", patterns: ["France\\s+(?:2|3|4|5)", "france\\.tv"] },
  { key: "lequipe", label: "L'Équipe", officialUrl: "https://www.lequipe.fr/tv/", patterns: ["(?:la\\s+cha[iî]ne\\s+)?L[’']?Équipe(?:\\s+Live\\s+Foot)?"] },
  { key: "rmc-sport", label: "RMC Sport", officialUrl: "https://rmcsport.bfmtv.com/", patterns: ["RMC\\s+Sport(?:\\s+\\d+)?"] },
  { key: "eurosport", label: "Eurosport", officialUrl: "https://www.eurosport.fr/", patterns: ["Eurosport(?:\\s+[12])?"] },
  { key: "prime-video", label: "Prime Video", officialUrl: "https://www.primevideo.com/", affiliateProgram: { network: "Amazon Partenaires", programUrl: "https://partenaires.amazon.fr/promotion/piv", verifiedAt: "2026-10-02" }, patterns: ["(?:Amazon\\s+)?Prime\\s+Video"] },
  { key: "uefa-tv", label: "UEFA.tv", officialUrl: "https://www.uefa.tv/", patterns: ["UEFA\\.tv"] },
  { key: "fifa-plus", label: "FIFA+", officialUrl: "https://www.plus.fifa.com/", patterns: ["FIFA\\+"] },
];

const TOKEN_PATTERN = BROADCASTERS.flatMap((spec) => spec.patterns.map((pattern) => `(?:${pattern})`)).join("|");
const TOKEN_RE = new RegExp(`(${TOKEN_PATTERN})`, "gi");

function specFor(value: string): BroadcasterSpec | null {
  for (const spec of BROADCASTERS) {
    if (spec.patterns.some((pattern) => new RegExp(`^(?:${pattern})$`, "i").test(value))) return spec;
  }
  return null;
}

export function resolveBroadcasterMention(value: string): BroadcasterLink | null {
  const spec = specFor(value.trim());
  if (!spec) return null;
  const affiliateUrl = spec.affiliateUrl?.trim();
  return {
    key: spec.key,
    label: spec.label,
    text: value,
    href: affiliateUrl || spec.officialUrl,
    sponsored: Boolean(affiliateUrl),
  };
}

export function tokenizeBroadcasterText(text: string): BroadcasterToken[] {
  if (!text) return [{ kind: "text", text }];
  const out: BroadcasterToken[] = [];
  let last = 0;
  TOKEN_RE.lastIndex = 0;
  for (const match of text.matchAll(TOKEN_RE)) {
    const index = match.index ?? 0;
    if (index > last) out.push({ kind: "text", text: text.slice(last, index) });
    const raw = match[0] ?? "";
    const link = resolveBroadcasterMention(raw);
    out.push(link ? { kind: "link", ...link } : { kind: "text", text: raw });
    last = index + raw.length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out.length ? out : [{ kind: "text", text }];
}

export function extractBroadcasters(texts: string[]): BroadcasterLink[] {
  const found = new Map<string, BroadcasterLink>();
  for (const text of texts) {
    for (const token of tokenizeBroadcasterText(text)) {
      if (token.kind === "link" && !found.has(token.key)) found.set(token.key, token);
    }
  }
  return [...found.values()];
}
