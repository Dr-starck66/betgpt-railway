import { classifySearchReferrer, SEARCH_ENGINES, type SearchTruthSource } from "@/lib/search/search-truth";

export const ANALYTICS_EVENTS = {
  landing: "landing",
  match_view: "match_view",
  hunter_open: "hunter_open",
  hunter_scenario: "hunter_scenario",
  why_this_score: "why_this_score",
  match_analyzed: "match_analyzed",
  chat_ask: "chat_ask",
  chat_share: "chat_share",
  chat_share_copy: "chat_share_copy",
  chat_challenge_view: "chat_challenge_view",
  chat_challenge_accept: "chat_challenge_accept",
  favorite_add: "favorite_add",
  favorite_remove: "favorite_remove",
  return_visit: "return_visit",
  share: "share",
  monetization_click: "monetization_click",
  ad_impression: "ad_impression",
} as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS] | `chat_share_${string}`;

const KEY = "betgpt-analytics";
const VISIT = "betgpt-visit";
const SEARCH_SOURCE = "betgpt-search-source";

function currentSearchSource(): SearchTruthSource | null {
  if (typeof window === "undefined") return null;
  try {
    const existing = sessionStorage.getItem(SEARCH_SOURCE);
    if (existing && Object.prototype.hasOwnProperty.call(SEARCH_ENGINES, existing)) return existing as SearchTruthSource;
    const source = classifySearchReferrer(document.referrer || "");
    if (source) sessionStorage.setItem(SEARCH_SOURCE, source);
    return source;
  } catch {
    return classifySearchReferrer(document.referrer || "");
  }
}

type Row = { t: number; e: string; p?: string };

function read(): Row[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const p = JSON.parse(raw) as Row[];
    return Array.isArray(p) ? p.slice(-200) : [];
  } catch {
    return [];
  }
}

function write(rows: Row[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(rows.slice(-200)));
  } catch {
    /* */
  }
}

export function track(event: AnalyticsEvent, payload?: string): void {
  if (typeof window === "undefined") return;
  const rows = read();
  rows.push({ t: Date.now(), e: event, p: payload?.slice(0, 80) });
  write(rows);
  const route = window.location.pathname.slice(0, 120);
  const s = currentSearchSource() ?? undefined;
  void fetch("/api/analytics", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ e: event, p: payload?.slice(0, 80), route, s }),
    credentials: "omit",
    keepalive: true,
  }).catch(() => undefined);
}

export function readAnalytics(): Row[] {
  if (typeof window === "undefined") return [];
  return read();
}

export function markVisit(): void {
  if (typeof window === "undefined") return;
  try {
    const prev = localStorage.getItem(VISIT);
    localStorage.setItem(VISIT, String(Date.now()));
    if (prev) track("return_visit");
    else track("landing");
  } catch {
    /* */
  }
}
