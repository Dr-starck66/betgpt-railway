const DEFAULT_STOPWORDS = new Set([
  "a","au","aux","avec","ce","ces","dans","de","des","du","elle","en","et","eux","il","je","la","le","les","leur","lui","ma","mais","me","meme","mes","moi","mon","ne","nos","notre","nous","on","ou","par","pas","pour","qu","que","qui","sa","se","ses","son","sur","ta","te","tes","toi","ton","tu","un","une","vos","votre","vous",
  "the","a","an","and","or","of","to","in","on","for","with","from","by","at","as","is","are","be","this","that","these","those","your","our","their","it","its"
]);

const GENERIC_ANCHORS = new Set([
  "ici","cliquez ici","en savoir plus","voir","voir plus","lire","lire plus","plus d infos","plus d'informations",
  "click here","learn more","read more","more","details"
]);

export function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(value = "", stopwords = DEFAULT_STOPWORDS) {
  return [...new Set(
    normalizeText(value)
      .split(" ")
      .filter((token) => token.length >= 3 && !stopwords.has(token) && !/^\d+$/.test(token))
  )];
}

export function jaccard(a = [], b = []) {
  const A = new Set(a);
  const B = new Set(b);
  if (!A.size || !B.size) return 0;
  let intersection = 0;
  for (const token of A) if (B.has(token)) intersection++;
  return intersection / (A.size + B.size - intersection);
}

export function overlapCoefficient(a = [], b = []) {
  const A = new Set(a);
  const B = new Set(b);
  if (!A.size || !B.size) return 0;
  let intersection = 0;
  for (const token of A) if (B.has(token)) intersection++;
  return intersection / Math.min(A.size, B.size);
}

export function semanticSimilarity(a = [], b = []) {
  return Number((0.45 * jaccard(a, b) + 0.55 * overlapCoefficient(a, b)).toFixed(4));
}

function stripTags(value = "") {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\{[^{}]{0,500}\}/g, " ")
    .replace(/&[a-z]+;/gi, " ");
}

function firstMatch(source, patterns) {
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match?.[1]) return String(match[1]).replace(/\s+/g, " ").trim();
  }
  return "";
}

export function extractRoutePath(source = "", fallback = "") {
  const match = source.match(/createFileRoute\(\s*["'`]([^"'`]+)["'`]\s*\)/i);
  const raw = match?.[1] || fallback || "";
  if (!raw) return "";
  const route = raw
    .replace(/\$([A-Za-z0-9_]+)/g, ":$1")
    .replace(/\/+$/, "");
  return route || "/";
}

export function extractPageSignals(source = "", fallbackRoute = "") {
  const route = extractRoutePath(source, fallbackRoute);
  const title = firstMatch(source, [
    /\btitle\s*:\s*["'`]([^"'`]{3,})["'`]/i,
    /<title[^>]*>([^<]{3,})<\/title>/i,
  ]);
  const h1 = firstMatch(source, [
    /<h1[^>]*>([\s\S]{1,300}?)<\/h1>/i,
  ]).replace(/<[^>]+>/g, " ");
  const description = firstMatch(source, [
    /name\s*:\s*["']description["'][^}]{0,260}?content\s*:\s*["'`]([^"'`]{15,})["'`]/i,
  ]);
  const robotsBlock = [...source.matchAll(/\{[^{}]{0,360}name\s*:\s*["']robots["'][^{}]{0,360}\}/gi)]
    .map((m) => m[0]).join(" ");
  const noindex = /noindex/i.test(robotsBlock) && !/\bindex\s*,\s*follow\b/i.test(robotsBlock);
  const redirect = /\bredirect\s*\(/i.test(source);
  const layoutOnly = /<Outlet\b/i.test(source) && !/<h1\b/i.test(source) && !/\bhead\s*:/i.test(source);
  const text = stripTags(source)
    .replace(/\b(import|export|const|let|function|return|className|component|createFileRoute|head|meta|links)\b/g, " ");
  const topicText = [route.replace(/[\/:_-]+/g, " "), title, h1, description, text.slice(0, 9000)].join(" ");
  const intentText = [route.replace(/[\/:_-]+/g, " "), title, h1].join(" ");
  return {
    route,
    title,
    h1,
    description,
    indexable: Boolean(route) && !noindex && !redirect && !layoutOnly,
    tokens: tokenize(topicText).slice(0, 220),
    intentTokens: tokenize(intentText).slice(0, 40),
  };
}

export function extractInternalLinks(source = "", sourceRoute = "") {
  const links = [];
  const tagRx = /<(?:a|Link)\b([^>]{0,1200})>([\s\S]{0,1200}?)<\/(?:a|Link)>/gi;
  for (const match of source.matchAll(tagRx)) {
    const attrs = match[1] || "";
    const href = attrs.match(/(?:href|to)\s*=\s*["'`]([^"'`]+)["'`]/i)?.[1] || "";
    if (!href.startsWith("/") || href.startsWith("//")) continue;
    const target = href.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
    const anchor = normalizeText(stripTags(match[2] || ""));
    links.push({ sourceRoute, targetRoute: target, anchor });
  }
  const objectRx = /(?:href|to)\s*:\s*["'`]([^"'`]+)["'`]/gi;
  for (const match of source.matchAll(objectRx)) {
    const href = match[1] || "";
    if (!href.startsWith("/") || href.startsWith("//")) continue;
    const target = href.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
    links.push({ sourceRoute, targetRoute: target, anchor: "" });
  }
  return links;
}

export function analyzeSemanticFlow(pages = [], links = [], config = {}) {
  const cfg = {
    cannibalizationThreshold: 0.86,
    intentCannibalizationThreshold: 0.82,
    semanticJumpThreshold: 0.09,
    glideMin: 0.16,
    glideMax: 0.82,
    orphanMode: "partial",
    strategicRoutes: [],
    ...config,
  };
  const strategic = new Set(cfg.strategicRoutes || []);
  const pageByRoute = new Map(pages.filter((p) => p.indexable && p.route).map((p) => [p.route, p]));
  const findings = [];
  const edges = [];
  const inbound = new Map([...pageByRoute.keys()].map((route) => [route, 0]));

  const validLinks = links.filter((link) => pageByRoute.has(link.targetRoute));
  for (const link of validLinks) {
    inbound.set(link.targetRoute, (inbound.get(link.targetRoute) || 0) + 1);
    const source = pageByRoute.get(link.sourceRoute);
    const target = pageByRoute.get(link.targetRoute);
    if (!source || !target || source.route === target.route) continue;
    const similarity = semanticSimilarity(source.tokens, target.tokens);
    const intentSimilarity = semanticSimilarity(source.intentTokens, target.intentTokens);
    const status = similarity < cfg.semanticJumpThreshold ? "PARTIAL" : "PASS";
    edges.push({
      source: source.route,
      target: target.route,
      anchor: link.anchor || "",
      similarity,
      intentSimilarity,
      status,
    });
    if (status === "PARTIAL") {
      findings.push({
        status: "PARTIAL",
        code: "SEMANTIC_JUMP",
        routes: [source.route, target.route],
        message: `Lien potentiellement trop éloigné sémantiquement (score=${similarity}).`,
      });
    }
    if (link.anchor && GENERIC_ANCHORS.has(link.anchor)) {
      findings.push({
        status: "PARTIAL",
        code: "GENERIC_ANCHOR",
        routes: [source.route, target.route],
        message: `Ancre générique: "${link.anchor}".`,
      });
    }
  }

  const indexable = [...pageByRoute.values()];
  const pairScores = [];
  for (let i = 0; i < indexable.length; i++) {
    for (let j = i + 1; j < indexable.length; j++) {
      const a = indexable[i];
      const b = indexable[j];
      const similarity = semanticSimilarity(a.tokens, b.tokens);
      const intentSimilarity = semanticSimilarity(a.intentTokens, b.intentTokens);
      pairScores.push({ a: a.route, b: b.route, similarity, intentSimilarity });
      if (similarity >= cfg.cannibalizationThreshold && intentSimilarity >= cfg.intentCannibalizationThreshold) {
        findings.push({
          status: "FAIL",
          code: "CANNIBALIZATION_HIGH",
          routes: [a.route, b.route],
          message: `Intentions et vocabulaires trop proches (semantic=${similarity}, intent=${intentSimilarity}).`,
        });
      }
    }
  }

  for (const page of indexable) {
    if (page.route === "/") continue;
    const count = inbound.get(page.route) || 0;
    if (count > 0) continue;
    const mustFail = strategic.has(page.route) || cfg.orphanMode === "fail";
    findings.push({
      status: mustFail ? "FAIL" : "PARTIAL",
      code: "ORPHAN_PAGE",
      routes: [page.route],
      message: mustFail
        ? "Page stratégique sans lien interne entrant détectable."
        : "Page sans lien interne entrant détectable.",
    });
  }

  const recommendations = [];
  for (const child of indexable) {
    if (child.route === "/") continue;
    const candidates = indexable
      .filter((parent) => parent.route !== child.route)
      .map((parent) => ({
        parent: parent.route,
        child: child.route,
        similarity: semanticSimilarity(parent.tokens, child.tokens),
        intentSimilarity: semanticSimilarity(parent.intentTokens, child.intentTokens),
      }))
      .filter((item) => item.similarity >= cfg.glideMin && item.similarity <= cfg.glideMax)
      .sort((a, b) => b.similarity - a.similarity || b.intentSimilarity - a.intentSimilarity);
    if (candidates[0]) recommendations.push(candidates[0]);
  }

  const fails = findings.filter((f) => f.status === "FAIL").length;
  const partials = findings.filter((f) => f.status === "PARTIAL").length;
  const verdict = fails ? "FAIL" : partials ? "PARTIAL" : "PASS";
  return {
    summary: {
      pages: indexable.length,
      links: validLinks.length,
      failures: fails,
      partials,
      verdict,
    },
    findings,
    edges,
    recommendations,
    pairScores,
    inbound: Object.fromEntries(inbound),
  };
}
