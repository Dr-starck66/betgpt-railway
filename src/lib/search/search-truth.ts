export const SEARCH_ENGINES = {
  google: ["google."],
  bing: ["bing.com"],
  duckduckgo: ["duckduckgo.com"],
  yahoo: ["search.yahoo."],
  ecosia: ["ecosia.org"],
  qwant: ["qwant.com"],
  brave: ["search.brave.com"],
  yandex: ["yandex."],
  baidu: ["baidu.com"],
} as const;

export type SearchTruthSource = keyof typeof SEARCH_ENGINES;

export function classifySearchReferrer(value: string): SearchTruthSource | null {
  if (!value) return null;
  let host = "";
  try {
    host = new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
  for (const [source, fragments] of Object.entries(SEARCH_ENGINES) as [SearchTruthSource, readonly string[]][]) {
    if (fragments.some((fragment) => host === fragment.replace(/\.$/, "") || host.includes(fragment))) return source;
  }
  return null;
}

export function isHumanSearchLandingRequest(input: {
  method?: string;
  pathname?: string;
  userAgent?: string;
  secFetchDest?: string;
}): boolean {
  if ((input.method || "GET").toUpperCase() !== "GET") return false;
  const path = input.pathname || "/";
  if (/^\/(api|__|assets|favicon|robots\.txt|sitemap|news-sitemap|feed\.json)(?:\/|$)/i.test(path)) return false;
  if (/\.(?:css|js|mjs|map|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|xml|json)$/i.test(path)) return false;
  const ua = input.userAgent || "";
  if (/bot|crawler|spider|slurp|bingpreview|facebookexternalhit|twitterbot|google-inspectiontool/i.test(ua)) return false;
  if (input.secFetchDest && input.secFetchDest !== "document") return false;
  return true;
}

export type SearchTruthAvailability = {
  organicLandings: "MEASURED";
  sourceEngine: "MEASURED";
  landingPages: "MEASURED";
  queries: "UNAVAILABLE";
  serpImpressions: "UNAVAILABLE";
  serpCtr: "UNAVAILABLE";
  averagePosition: "UNAVAILABLE";
};

export const SEARCH_TRUTH_AVAILABILITY: SearchTruthAvailability = {
  organicLandings: "MEASURED",
  sourceEngine: "MEASURED",
  landingPages: "MEASURED",
  queries: "UNAVAILABLE",
  serpImpressions: "UNAVAILABLE",
  serpCtr: "UNAVAILABLE",
  averagePosition: "UNAVAILABLE",
};
