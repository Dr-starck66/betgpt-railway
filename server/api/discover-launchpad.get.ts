import { defineEventHandler, getRequestURL, setHeader, setResponseStatus } from "h3";
import { discoverLaunchpadStaticAudit, recentDiscoverCandidates } from "../../src/lib/editorial/discover-launchpad";
import { readLedgerDurable } from "../../src/lib/editorial/ledger-store";
import { manualEditorialArticles } from "../../src/lib/editorial/manual-articles";

function decode(value = "") {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function tags(html: string, name: string): string[] {
  return [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, "gi"))].map((match) => match[0]);
}

function attr(tag: string, name: string): string {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return match ? decode(match[1] ?? "") : "";
}

function meta(html: string, key: string, value: string): string {
  for (const tag of tags(html, "meta")) {
    if (attr(tag, key).toLowerCase() === value.toLowerCase()) return attr(tag, "content");
  }
  return "";
}

function link(html: string, rel: string): string {
  for (const tag of tags(html, "link")) {
    if (attr(tag, "rel").toLowerCase().split(/\s+/).includes(rel.toLowerCase())) return attr(tag, "href");
  }
  return "";
}

function jsonLdTypes(html: string): Set<string> {
  const out = new Set<string>();
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const root = JSON.parse(match[1] ?? "{}");
      const walk = (value: unknown) => {
        if (!value || typeof value !== "object") return;
        if (Array.isArray(value)) {
          for (const item of value) walk(item);
          return;
        }
        const row = value as Record<string, unknown>;
        const type = row["@type"];
        if (typeof type === "string") out.add(type);
        else if (Array.isArray(type)) for (const item of type) if (typeof item === "string") out.add(item);
        if (Array.isArray(row["@graph"])) for (const item of row["@graph"]) walk(item);
        if (row.mainEntityOfPage) walk(row.mainEntityOfPage);
      };
      walk(root);
    } catch {
      // Invalid JSON-LD is surfaced through missing required schema types.
    }
  }
  return out;
}

function normPath(value: string): string {
  try {
    return decodeURIComponent(new URL(value).pathname).replace(/\/+$/, "") || "/";
  } catch {
    return "";
  }
}

async function renderedAudit(origin: string, slug: string) {
  const url = new URL(`/actualites/${slug}`, origin).toString();
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(12_000),
    headers: {
      "user-agent": "ASTRA-DISCOVER-LAUNCHPAD/1.0",
      "cache-control": "no-cache",
      accept: "text/html,application/xhtml+xml,*/*",
    },
  });
  const html = await response.text();
  const robots = meta(html, "name", "robots").toLowerCase();
  const canonical = link(html, "canonical");
  const ogImage = meta(html, "property", "og:image");
  const ogWidth = Number(meta(html, "property", "og:image:width") || 0);
  const ogHeight = Number(meta(html, "property", "og:image:height") || 0);
  const h1 = (html.match(/<h1\b/gi) ?? []).length;
  const schema = jsonLdTypes(html);
  const failures: string[] = [];

  if (response.status !== 200) failures.push(`HTTP_${response.status}`);
  if (/noindex/.test(robots)) failures.push("NOINDEX");
  if (!/max-image-preview:large/.test(robots)) failures.push("MAX_IMAGE_PREVIEW_LARGE_MISSING");
  if (h1 !== 1) failures.push(`H1_${h1}`);
  if (!canonical || normPath(canonical) !== normPath(url)) failures.push("SELF_CANONICAL_MISSING");
  if (!ogImage) failures.push("OG_IMAGE_MISSING");
  if (ogWidth < 1200) failures.push(`OG_IMAGE_WIDTH_${ogWidth || 0}`);
  if (ogWidth * ogHeight <= 300_000) failures.push(`OG_IMAGE_PIXELS_${ogWidth * ogHeight}`);
  if (!schema.has("NewsArticle") && !schema.has("Article") && !schema.has("BlogPosting")) failures.push("ARTICLE_SCHEMA_MISSING");
  if (!schema.has("BreadcrumbList")) failures.push("BREADCRUMB_SCHEMA_MISSING");
  if (!schema.has("WebPage")) failures.push("WEBPAGE_SCHEMA_MISSING");

  return {
    url,
    httpStatus: response.status,
    pass: failures.length === 0,
    failures,
    signals: {
      robots,
      canonical,
      h1,
      ogImage,
      ogWidth,
      ogHeight,
      schemaTypes: [...schema].sort(),
    },
  };
}

export default defineEventHandler(async (event) => {
  setHeader(event, "cache-control", "no-store, no-cache, must-revalidate, max-age=0");
  const origin = getRequestURL(event).origin;
  const now = new Date();

  try {
    const durable = await readLedgerDurable();
    const manual = manualEditorialArticles();
    const byId = new Map([...manual, ...durable].map((article) => [article.id, article]));
    const candidates = recentDiscoverCandidates([...byId.values()], now, 48).slice(0, 8);

    if (!candidates.length) {
      return {
        schema: "astra-discover-launchpad/v1",
        status: "UNVERIFIED",
        reason: "NO_RECENT_PUBLIC_ARTICLE_48H",
        checkedAt: now.toISOString(),
        candidates: [],
        googlePolicy: {
          discoverGuarantee: false,
          largeImageMinWidth: 1200,
          minPixels: 300000,
          preferredAspect: "16:9",
        },
      };
    }

    const reports = [];
    let fail = false;
    let review = false;

    for (const article of candidates) {
      const staticAudit = discoverLaunchpadStaticAudit(article, now);
      let rendered;
      try {
        rendered = await renderedAudit(origin, article.slug);
      } catch (error) {
        rendered = {
          url: new URL(`/actualites/${article.slug}`, origin).toString(),
          httpStatus: 0,
          pass: false,
          failures: [error instanceof Error ? error.message : String(error)],
          signals: null,
        };
      }
      if (!staticAudit.hardPass || !rendered.pass) fail = true;
      if (staticAudit.verdict === "REVIEW") review = true;
      reports.push({ static: staticAudit, rendered });
    }

    const status = fail ? "FAIL" : review ? "PASS" : "PASS";
    if (fail) setResponseStatus(event, 503);

    return {
      schema: "astra-discover-launchpad/v1",
      status,
      checkedAt: now.toISOString(),
      candidateWindowHours: 48,
      candidateCount: reports.length,
      readyCount: reports.filter((row) => row.static.hardPass && row.rendered.pass).length,
      reviewCount: reports.filter((row) => row.static.verdict === "REVIEW").length,
      googlePolicy: {
        discoverGuarantee: false,
        indexedContentRequired: true,
        largeImageMinWidth: 1200,
        minPixels: 300000,
        preferredAspect: "16:9",
        maxImagePreviewLarge: true,
        avoidClickbait: true,
        preferOriginalTimelyTopicExpertise: true,
      },
      candidates: reports,
    };
  } catch (error) {
    setResponseStatus(event, 503);
    return {
      schema: "astra-discover-launchpad/v1",
      status: "FAIL",
      checkedAt: now.toISOString(),
      error: error instanceof Error ? error.message : String(error),
    };
  }
});
