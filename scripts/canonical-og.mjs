/** Canonical share tags for betgpt.live — the PWA injector stamps grok.me hosts. */

export const CANONICAL_ORIGIN = "https://betgpt.live";
export const CANONICAL_OG_IMAGE = `${CANONICAL_ORIGIN}/og-betgpt-pronostics-cotes-football.jpg`;

/** @param {string} html @param {RegExp} re */
function attr(html, re) {
  const m = html.match(re);
  return m?.[1]?.trim() ?? "";
}

/**
 * Replace or insert a single property/name meta tag.
 * @param {string} html
 * @param {"property" | "name"} kind
 * @param {string} key
 * @param {string} content
 */
function upsertMeta(html, kind, key, content) {
  const tag = `<meta ${kind}="${key}" content="${content}">`;
  const re = new RegExp(`<meta\\b[^>]*(?:property|name)=["']${key}["'][^>]*>`, "i");
  if (re.test(html)) return html.replace(re, tag);
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${tag}</head>`);
  return html;
}

/** @param {string} html */
export function rewriteCanonicalOg(html) {
  if (!html || typeof html !== "string") return html;
  if (!/<html[\s>]/i.test(html)) return html;
  let out = html;

  const title = attr(out, /<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title) {
    out = upsertMeta(out, "property", "og:title", title);
    out = upsertMeta(out, "name", "twitter:title", title);
  }
  const desc =
    attr(out, /<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i) ||
    attr(out, /<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i);
  if (desc) {
    out = upsertMeta(out, "property", "og:description", desc);
    out = upsertMeta(out, "name", "twitter:description", desc);
  }

  const canonical =
    attr(out, /rel=["']canonical["'][^>]*href=["']([^"']+)["']/i) ||
    attr(out, /href=["']([^"']+)["'][^>]*rel=["']canonical["']/i) ||
    CANONICAL_ORIGIN;
  out = upsertMeta(out, "property", "og:url", canonical);
  out = upsertMeta(out, "property", "og:site_name", "BetGPT");

  const existingOgImage =
    attr(out, /<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
    attr(out, /<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
  const isLegacyGrokImage = (value) => {
    try {
      const host = new URL(value).hostname.toLowerCase();
      return host === "og.grok.me" || host.endsWith(".grok.me");
    } catch {
      return false;
    }
  };
  const canonicalImage =
    existingOgImage && !isLegacyGrokImage(existingOgImage)
      ? existingOgImage
      : CANONICAL_OG_IMAGE;

  const existingTwitterImage =
    attr(out, /<meta[^>]+name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i) ||
    attr(out, /<meta[^>]+content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i);
  const canonicalTwitterImage =
    existingTwitterImage && !isLegacyGrokImage(existingTwitterImage)
      ? existingTwitterImage
      : canonicalImage;

  out = upsertMeta(out, "property", "og:image", canonicalImage);
  out = upsertMeta(out, "name", "twitter:image", canonicalTwitterImage);
  out = upsertMeta(out, "name", "twitter:card", "summary_large_image");
  return out;
}
