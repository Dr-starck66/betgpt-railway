import { redirectToBook } from "@/engine/go";
import { logClick, safeAffiliateUrl } from "@/engine/clicks";
import { decorateAffiliateUrl, landingFor } from "@/engine/aff-tag";

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
    const paid = decorateAffiliateUrl(book, target) ?? target;
    const dest = safeAffiliateUrl(paid) ?? paid;
    try {
      logClick(book || "book", dest, matchId);
    } catch {
      /* le clic part quand même */
    }
    return Response.redirect(dest, 302);
  } catch {
    return new Response("Lien bookmaker introuvable", { status: 404 });
  }
}
