import { redirectToBook } from "@/engine/go";
import { logClick, safeAffiliateUrl } from "@/engine/clicks";
import { decorateAffiliateUrl, landingFor } from "@/engine/aff-tag";
import { affiliateBookReadiness } from "@/engine/affiliate-conversion";
import { recordAnalytics } from "@/lib/store";

function isMatchPage(href: string): boolean {
  if (/betclic\.(fr|com)/i.test(href) && /-m\d+/.test(href)) return true;
  if (/unibet\.(fr|com)/i.test(href) && /\/\d{4,}\//.test(href)) return true;
  if (/netbet\.fr/i.test(href) && /\/evenement\/\d+/.test(href)) return true;
  if (/vbet\.fr/i.test(href) && /\/paris-sportifs\/match\//.test(href)) return true;
  if (/winamax\.fr/i.test(href) && /\/match\/\d+/.test(href)) return true;
  return false;
}

export async function handleGoRequest(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const book = url.searchParams.get("b") ?? "";
    const matchId = url.searchParams.get("m") ?? "";
    const direct = safeAffiliateUrl(url.searchParams.get("u") ?? "");
    let target: string | null = null;
    if (direct && (isMatchPage(direct) || safeAffiliateUrl(direct))) {
      target = direct;
    }
    if (!target) {
      try {
        target = await redirectToBook(matchId, book);
      } catch {
        target = direct;
      }
    }
    if (!target) target = landingFor(book);
    const readiness = affiliateBookReadiness(book);
    const paid = decorateAffiliateUrl(book, target) ?? target;
    const dest = safeAffiliateUrl(paid) ?? paid;
    try {
      logClick(book || "book", dest, matchId);
      void recordAnalytics("affiliate_click", `${readiness.key}:${readiness.mode.toLowerCase()}`, "/api/go");
    } catch {
      /* le clic part quand même */
    }
    return new Response(null, {
      status: 302,
      headers: {
        location: dest,
        "cache-control": "no-store",
        "x-betgpt-affiliate-mode": readiness.mode.toLowerCase(),
        "x-betgpt-affiliate-book": readiness.key,
      },
    });
  } catch {
    return new Response("Lien bookmaker introuvable", { status: 404 });
  }
}
