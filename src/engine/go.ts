import { ensureLive, getUpcomingMatches } from "./live";
import { safeAffiliateUrl } from "./clicks";
import { FR_BOOK_RE } from "./affiliates";
import type { MatchInput } from "./types";

function isMatchPage(href: string): boolean {
  if (/betclic\.(fr|com)/i.test(href) && /-m\d+/.test(href)) return true;
  if (/unibet\.(fr|com)/i.test(href) && /\/\d{5,}\//.test(href)) return true;
  if (/netbet\.fr/i.test(href) && /\/evenement\/\d+/.test(href)) return true;
  if (/vbet\.fr/i.test(href) && /\/paris-sportifs\/match\//.test(href)) return true;
  if (/winamax\.fr/i.test(href) && /\/match\/\d+/.test(href)) return true;
  return false;
}

function urlOnMatch(match: MatchInput, bookRaw: string): string | undefined {
  const want = bookRaw.toLowerCase();
  const links = match.ticketLinks ?? [];
  const hit = links.find((l) => l.book.toLowerCase().includes(want) && isMatchPage(l.url));
  if (hit?.url) return hit.url;
  const odds = match.current.find((b) => b.book.toLowerCase().includes(want) && b.url && isMatchPage(b.url));
  return odds?.url;
}

export async function redirectToBook(matchId: string, bookRaw: string): Promise<string | null> {
  try {
    await ensureLive();
  } catch {
    return null;
  }
  if (!FR_BOOK_RE.test(bookRaw) && !/365/.test(bookRaw)) return null;
  const matches = getUpcomingMatches() as MatchInput[];
  const match = matches.find((m: MatchInput) => m.id === matchId);
  const raw = match ? urlOnMatch(match, bookRaw) : undefined;
  const dest = safeAffiliateUrl(raw ?? "");
  if (dest && isMatchPage(dest)) return dest;
  return dest;
}