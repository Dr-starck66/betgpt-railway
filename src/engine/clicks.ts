import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { recordClick } from "@/lib/store";

export type AffiliateClick = {
  at: string;
  book: string;
  matchId: string;
  url: string;
};

const FILE = join(process.cwd(), "data", "clicks.json");

function load(): AffiliateClick[] {
  try {
    return JSON.parse(readFileSync(FILE, "utf8")) as AffiliateClick[];
  } catch {
    return [];
  }
}

export function logClick(book: string, url: string, matchId = ""): void {
  try {
    const rows = load();
    rows.unshift({ at: new Date().toISOString(), book, url, matchId });
    mkdirSync(dirname(FILE), { recursive: true });
    writeFileSync(FILE, JSON.stringify(rows.slice(0, 400), null, 2));
  } catch {
    /* filesystem may be read-only in prod */
  }
  void recordClick(book, matchId, url);
}

export function recentClicks(n = 40): AffiliateClick[] {
  return load().slice(0, n);
}

const HOSTS = new Set([
  "unibet.fr",
  "www.unibet.fr",
  "unibet.be",
  "www.unibet.be",
  "betclic.fr",
  "www.betclic.fr",
  "bet365.fr",
  "www.bet365.fr",
  "netbet.fr",
  "www.netbet.fr",
  "winamax.fr",
  "www.winamax.fr",
  "sports.bwin.fr",
  "bwin.fr",
  "www.bwin.fr",
  "paris-sportifs.pmu.fr",
  "enligne.parionssport.fdj.fr",
  "zebet.fr",
  "www.zebet.fr",
  "vbet.fr",
  "www.vbet.fr",
  "genybet.fr",
  "www.genybet.fr",
  "m.genybet.fr",
]);

export function safeAffiliateUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return null;
    if (u.username || u.password) return null;
    if (u.port) return null;
    const host = u.hostname.toLowerCase();
    if (!HOSTS.has(host)) return null;
    if (host !== u.hostname.toLowerCase()) return null;
    return u.href;
  } catch {
    return null;
  }
}

export function trackedUrl(book: string, url: string, matchId?: string): string {
  const q = new URLSearchParams({ b: book, u: url });
  if (matchId) q.set("m", matchId);
  return `/go?${q.toString()}`;
}
