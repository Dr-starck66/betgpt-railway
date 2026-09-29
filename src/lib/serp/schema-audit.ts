export type SchemaAudit = {
  schemaValid: boolean;
  eligibility: "GOOGLE_ELIGIBILITY_UNVERIFIED";
  errors: string[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function typesOf(node: Record<string, unknown>): string[] {
  const t = node["@type"];
  if (typeof t === "string") return [t];
  if (Array.isArray(t)) return t.filter((x) => typeof x === "string");
  return [];
}

/** JSON shape check only. A valid graph is not a Google rich-result pass. */
export function auditJsonLd(data: unknown): SchemaAudit {
  const errors: string[] = [];
  const root = asRecord(data);
  if (!root) return { schemaValid: false, eligibility: "GOOGLE_ELIGIBILITY_UNVERIFIED", errors: ["json-ld absent"] };
  const graph = Array.isArray(root["@graph"]) ? root["@graph"].map(asRecord).filter((n): n is Record<string, unknown> => !!n) : [root];
  const sports = graph.find((n) => typesOf(n).includes("SportsEvent"));
  if (!sports) errors.push("SportsEvent manquant");
  else {
    if (typesOf(sports).includes("BroadcastEvent")) errors.push("BroadcastEvent collé au tableau de score");
    if (typeof sports.name !== "string" || !sports.name) errors.push("SportsEvent.name");
    if (typeof sports.startDate !== "string" || !sports.startDate) errors.push("SportsEvent.startDate");
    const home = asRecord(sports.homeTeam);
    const away = asRecord(sports.awayTeam);
    if (!home || typeof home.name !== "string") errors.push("homeTeam");
    if (!away || typeof away.name !== "string") errors.push("awayTeam");
    if (typeof sports.url !== "string") errors.push("SportsEvent.url");
  }
  const crumbs = graph.find((n) => typesOf(n).includes("BreadcrumbList"));
  const items = crumbs && Array.isArray(crumbs.itemListElement) ? crumbs.itemListElement : [];
  if (!crumbs || items.length < 3) errors.push("BreadcrumbList incomplet");
  const videos = graph.filter((n) => typesOf(n).includes("VideoObject"));
  for (const video of videos) {
    for (const key of ["name", "description", "thumbnailUrl", "uploadDate", "embedUrl"]) {
      if (video[key] == null || video[key] === "") errors.push(`VideoObject.${key}`);
    }
    if (typeof video.embedUrl === "string" && !video.embedUrl.includes("/embed/")) errors.push("embedUrl hors player");
  }
  const broadcasts = graph.filter((n) => typesOf(n).includes("BroadcastEvent") && !typesOf(n).includes("SportsEvent"));
  if (broadcasts.length && videos.length === 0) errors.push("BroadcastEvent sans vidéo");
  for (const cast of broadcasts) {
    if (cast.isLiveBroadcast !== true) errors.push("BroadcastEvent sans diffusion live");
  }
  return { schemaValid: errors.length === 0, eligibility: "GOOGLE_ELIGIBILITY_UNVERIFIED", errors };
}
