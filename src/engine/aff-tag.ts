import { loadAdmin } from "./admin";
import { safeAffiliateUrl } from "./clicks";

export const AFF_BOOKS = [
  { key: "unibet", label: "Unibet", param: "btag", landing: "https://www.unibet.fr/" },
  { key: "betclic", label: "Betclic", param: "btag", landing: "https://www.betclic.fr/" },
  { key: "winamax", label: "Winamax", param: "clickid", landing: "https://www.winamax.fr/paris-sportifs" },
  { key: "netbet", label: "NetBet", param: "btag", landing: "https://www.netbet.fr/" },
  { key: "bet365", label: "Bet365", param: "affiliate", landing: "https://www.bet365.fr/" },
  { key: "bwin", label: "Bwin", param: "btag", landing: "https://sports.bwin.fr/" },
  { key: "pmu", label: "PMU", param: "btag", landing: "https://paris-sportifs.pmu.fr/" },
  { key: "vbet", label: "Vbet", param: "btag", landing: "https://www.vbet.fr/" },
  { key: "zebet", label: "ZEbet", param: "btag", landing: "https://www.zebet.fr/" },
  { key: "parionssport", label: "Parions Sport", param: "btag", landing: "https://enligne.parionssport.fdj.fr/" },
] as const;

export type AffKey = (typeof AFF_BOOKS)[number]["key"];

export function specOf(book: string): (typeof AFF_BOOKS)[number] | undefined {
  const n = book.toLowerCase().replace(/\s+/g, "");
  return AFF_BOOKS.find((b) => n.includes(b.key) || (b.key === "parionssport" && n.includes("parions")));
}

function tags(): Record<string, string> {
  const fromAdmin = loadAdmin().affTags ?? {};
  const out: Record<string, string> = { ...fromAdmin };
  for (const b of AFF_BOOKS) {
    const env = process.env[`AFF_${b.key.toUpperCase()}`]?.trim();
    if (env) out[b.key] = env;
  }
  return out;
}

export function hasAffiliateTags(): boolean {
  return AFF_BOOKS.some((b) => Boolean(tags()[b.key]?.trim()));
}

export function decorateAffiliateUrl(book: string, raw: string): string | null {
  const spec = specOf(book);
  const tagged = tags();
  const id = spec ? tagged[spec.key]?.trim() : "";
  let href = safeAffiliateUrl(raw);
  if (!href && spec) href = spec.landing;
  if (!href) return null;
  try {
    const u = new URL(href);
    if (id && spec) u.searchParams.set(spec.param, id);
    u.searchParams.set("utm_source", "betgpt");
    u.searchParams.set("utm_medium", "affiliate");
    return u.href;
  } catch {
    return href;
  }
}

export function landingFor(book: string): string {
  return specOf(book)?.landing ?? "https://www.unibet.fr/";
}
