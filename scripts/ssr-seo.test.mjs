import { describe, it } from "node:test";
import assert from "node:assert/strict";

const BASE = process.env.SSR_SEO_BASE ?? "http://127.0.0.1:8080";
const MATCH = `${BASE}/match/bayern-munich-1-fc-union-berlin-2026-09-18`;

async function get(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: "text/html,application/xml,text/plain", "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" },
    redirect: "manual",
  });
  const body = await res.text();
  return { status: res.status, ctype: res.headers.get("content-type") ?? "", location: res.headers.get("location"), body };
}

function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function ldBlocks(html) {
  const out = [];
  const re = /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    out.push(JSON.parse(m[1].replace(/\\u003c/g, "<").replace(/\\u003e/g, ">").replace(/\\u0026/g, "&")));
  }
  return out;
}

function flattenTypes(blocks) {
  const types = [];
  for (const b of blocks) {
    const items = b["@graph"] ?? (Array.isArray(b) ? b : [b]);
    for (const it of items) {
      if (it && typeof it === "object") types.push(it["@type"]);
    }
  }
  return types.flat();
}

describe("raw HTML SSR SEO", () => {
  it("robots.txt is reachable and does not block match/prono/championship", async () => {
    const r = await get("/robots.txt");
    assert.equal(r.status, 200);
    assert.match(r.ctype, /text\/plain/);
    assert.match(r.body, /Disallow: \/admin/);
    assert.doesNotMatch(r.body, /Disallow: \/chat/);
    assert.doesNotMatch(r.body, /Disallow: \/championship/);
    assert.doesNotMatch(r.body, /Disallow: \/match/);
    assert.doesNotMatch(r.body, /Disallow: \/prono/);
  });

  it("sitemap.xml lists the canonical match URL and not noindex aliases", async () => {
    const r = await get("/sitemap.xml");
    assert.equal(r.status, 200);
    assert.match(r.ctype, /xml/);
    assert.match(r.body, /<loc>https:\/\/betgpt\.live\/match\//);
    assert.doesNotMatch(r.body, /<loc>https:\/\/betgpt\.live\/chat</);
    assert.doesNotMatch(r.body, /<loc>https:\/\/betgpt\.live\/championship</);
    assert.doesNotMatch(r.body, /<loc>https:\/\/betgpt\.live\/prono\//);
    for (const [, date] of r.body.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)) {
      assert.ok(Date.parse(date) <= Date.now(), `Future/invalid lastmod: ${date}`);
    }
    const locations = [...r.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    assert.equal(new Set(locations).size, locations.length, "Duplicate canonical URL");
  });

  it("match HTML contains title, H1, article JSON-LD, FAQ, a single breadcrumb, frozen dates", async () => {
    const a = await fetch(MATCH, { headers: { Accept: "text/html" } });
    const html = await a.text();
    const b = await fetch(MATCH, { headers: { Accept: "text/html" } });
    const html2 = await b.text();
    assert.equal(a.status, 200);
    assert.match(html, /<title>Pronostic Bayern Munich/);
    assert.match(html, /analyse et score probable/);
    assert.match(html, /<h1[^>]*>Pronostic Bayern Munich/);
    assert.match(html, /rel="canonical" href="https:\/\/betgpt\.live\/match\/bayern-munich-1-fc-union-berlin-2026-09-18"/);
    assert.match(html, /property="og:image" content="https:\/\/betgpt\.live\/og-betgpt-pronostics-cotes-football\.jpg"/);
    assert.match(html, /property="og:url" content="https:\/\/betgpt\.live\/match\/bayern-munich-1-fc-union-berlin-2026-09-18"/);
    assert.doesNotMatch(html, /grok\.me\/(?:og|v1)/);
    const vis = visibleText(html);
    assert.match(vis, /favori assez net/);
    assert.match(vis, /Pourquoi BetGPT/);
    assert.match(vis, /Questions fréquentes/);
    assert.doesNotMatch(vis, /\bPPDA\b/);
    assert.doesNotMatch(vis, /field tilt/i);
    const blocks = ldBlocks(html);
    const types = flattenTypes(blocks);
    assert.ok(types.includes("SportsEvent"));
    assert.ok(types.includes("NewsArticle") || types.includes("LiveBlogPosting"));
    assert.ok(types.includes("FAQPage"));
    assert.equal(types.filter((t) => t === "BreadcrumbList").length, 1);
    const article = blocks
      .flatMap((b) => b["@graph"] ?? [b])
      .find((x) => x && (x["@type"] === "NewsArticle" || x["@type"] === "LiveBlogPosting"));
    assert.ok(article);
    assert.ok(String(article.articleBody).length > 800);
    const article2 = ldBlocks(html2)
      .flatMap((b) => b["@graph"] ?? [b])
      .find((x) => x && (x["@type"] === "NewsArticle" || x["@type"] === "LiveBlogPosting"));
    assert.equal(article.dateModified, article2.dateModified);
    const age = Date.now() - Date.parse(article.dateModified);
    assert.ok(Number.isFinite(age) && age > 60_000, `dateModified looks live-generated: ${article.dateModified}`);
  });

  it("/prono/{slug} 301s to /match/{slug}", async () => {
    const r = await get("/prono/bayern-munich-1-fc-union-berlin-2026-09-18");
    assert.equal(r.status, 301);
    assert.equal(r.location, "/match/bayern-munich-1-fc-union-berlin-2026-09-18");
  });

  it("championship and chat are noindex in raw HTML", async () => {
    const champ = await get("/championship");
    const chat = await get("/chat");
    assert.equal(champ.status, 200);
    assert.equal(chat.status, 200);
    assert.match(champ.body, /noindex/);
    assert.match(chat.body, /noindex/);
    assert.match(champ.body, /Championnat des modèles/);
  });

  it("SEO hub pages stay well under 400 KB", async () => {
    for (const path of ["/scores-en-direct", "/pronos-football", "/ledger", "/ligue-1"]) {
      const r = await get(path);
      assert.equal(r.status, 200, path);
      assert.ok(
        r.body.length < 400_000,
        `${path} is ${r.body.length} bytes — too heavy for Googlebot`,
      );
    }
  });
});
