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
  const intentText = [title, h1].filter(Boolean).join(" ") || route.replace(/[\/:_-]+/g, " ");
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
  const seen = new Set();
  const add = (href, anchor = "") => {
    if (!href || !href.startsWith("/") || href.startsWith("//")) return;
    const target = href.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
    const key = sourceRoute + "|" + target;
    if (seen.has(key)) return;
    seen.add(key);
    links.push({ sourceRoute, targetRoute: target, anchor: normalizeText(anchor) });
  };

  const tagRx = /<(?:a|Link)\b([^>]{0,1200})>([\s\S]{0,1200}?)<\/(?:a|Link)>/gi;
  for (const match of source.matchAll(tagRx)) {
    const attrs = match[1] || "";
    const href =
      attrs.match(/(?:href|to)\s*=\s*["\'`]([^"\'`]+)["\'`]/i)?.[1] ||
      attrs.match(/(?:href|to)\s*=\s*\{\s*`([^`]+)`\s*\}/i)?.[1] ||
      "";
    add(href, stripTags(match[2] || ""));
  }

  const jsxAttrRx = /(?:href|to)\s*=\s*["\'`]([^"\'`]+)["\'`]/gi;
  for (const match of source.matchAll(jsxAttrRx)) add(match[1] || "");

  const jsxTemplateRx = /(?:href|to)\s*=\s*\{\s*`([^`]+)`\s*\}/gi;
  for (const match of source.matchAll(jsxTemplateRx)) add(match[1] || "");

  const objectRx = /(?:href|to)\s*:\s*["\'`]([^"\'`]+)["\'`]/gi;
  for (const match of source.matchAll(objectRx)) add(match[1] || "");

  return links;
}

export function extractCatalogLinks(source = "", sourceRoute = "", properties = []) {
  const links = [];
  const seen = new Set();
  for (const property of properties) {
    if (!/^[A-Za-z0-9_]+$/.test(String(property))) continue;
    const pattern = new RegExp("\\b" + property + "\\s*:\\s*[\\\"\'`]([^\\\"\'`]+)[\\\"\'`]", "gi");
    for (const match of source.matchAll(pattern)) {
      const href = match[1] || "";
      if (!href.startsWith("/") || href.startsWith("//")) continue;
      const target = href.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
      const key = sourceRoute + "|" + target + "|" + property;
      if (seen.has(key)) continue;
      seen.add(key);
      links.push({ sourceRoute, targetRoute: target, anchor: normalizeText(property) });
    }
  }
  return links;
}
export function extractAutoRepairLinks(source = "") {
  const links = [];
  for (const rawLine of String(source).split("\n")) {
    const line = rawLine.trim().replace(/,$/, "");
    if (!line.startsWith('{"source":')) continue;
    try {
      const row = JSON.parse(line);
      if (!row?.source || !row?.href) continue;
      links.push({
        sourceRoute: row.source,
        targetRoute: row.href,
        anchor: normalizeText(row.anchor || ""),
        autoRepair: true,
      });
    } catch {
      // Ignore malformed non-data lines; generated registry syntax is tested separately.
    }
  }
  return links;
}

function routeSegments(route = "") {
  return String(route).split("/").filter(Boolean);
}

function routePatternMatches(target = "", candidate = "") {
  const targetSegments = routeSegments(target);
  const candidateSegments = routeSegments(candidate);
  if (targetSegments.length !== candidateSegments.length) return false;
  return candidateSegments.every((segment, index) => {
    const targetSegment = targetSegments[index] || "";
    if (segment.startsWith(":")) return Boolean(targetSegment);
    if (/^\$\{[^}]+\}$/.test(targetSegment) || targetSegment === ":dynamic") return true;
    return normalizeText(segment) === normalizeText(targetSegment);
  });
}

function resolveTargetRoute(target, pageByRoute) {
  if (pageByRoute.has(target)) return target;
  for (const candidate of pageByRoute.keys()) {
    if (routePatternMatches(target, candidate)) return candidate;
  }
  return "";
}

export function analyzeSemanticFlow(pages = [], links = [], config = {}) {
  const cfg = {
    cannibalizationThreshold: 0.86,
    intentCannibalizationThreshold: 0.82,
    semanticJumpThreshold: 0.09,
    glideMin: 0.16,
    glideMax: 0.82,
    recommendationIntentMin: 0.55,
    orphanMode: "partial",
    strategicRoutes: [],
    parentHints: {},
    ...config,
  };
  const strategic = new Set(cfg.strategicRoutes || []);
  const pageByRoute = new Map(pages.filter((p) => p.indexable && p.route).map((p) => [p.route, p]));
  const findings = [];
  const edges = [];
  const inbound = new Map([...pageByRoute.keys()].map((route) => [route, 0]));

  const validLinks = links
    .map((link) => {
      const resolved = resolveTargetRoute(link.targetRoute, pageByRoute);
      return resolved ? { ...link, targetRoute: resolved } : null;
    })
    .filter(Boolean);
  const descriptivePairs = new Set(
    validLinks
      .filter((link) => link.anchor && !GENERIC_ANCHORS.has(link.anchor))
      .map((link) => link.sourceRoute + "|" + link.targetRoute)
  );
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
    if (
      link.anchor &&
      GENERIC_ANCHORS.has(link.anchor) &&
      !descriptivePairs.has(link.sourceRoute + "|" + link.targetRoute)
    ) {
      findings.push({
        status: "PARTIAL",
        code: "GENERIC_ANCHOR",
        routes: [source.route, target.route],
        message: `Ancre générique sans alternative descriptive: "${link.anchor}".`,
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
  const hintedChildren = new Set();
  for (const [childRoute, parentRoute] of Object.entries(cfg.parentHints || {})) {
    const child = pageByRoute.get(childRoute);
    const parent = pageByRoute.get(parentRoute);
    if (!child || !parent || child.route === parent.route) continue;
    hintedChildren.add(child.route);
    recommendations.push({
      parent: parent.route,
      child: child.route,
      similarity: semanticSimilarity(parent.tokens, child.tokens),
      intentSimilarity: semanticSimilarity(parent.intentTokens, child.intentTokens),
      reason: "configured-parent-hint",
    });
  }

  for (const child of indexable) {
    if (child.route === "/" || hintedChildren.has(child.route)) continue;
    const candidates = indexable
      .filter((parent) => parent.route !== child.route)
      .map((parent) => {
        const structural = child.route.startsWith(parent.route.replace(/\/$/, "") + "/");
        return {
          parent: parent.route,
          child: child.route,
          similarity: semanticSimilarity(parent.tokens, child.tokens),
          intentSimilarity: semanticSimilarity(parent.intentTokens, child.intentTokens),
          structural,
          broaderIntent: parent.intentTokens.length < child.intentTokens.length,
        };
      })
      .filter((item) =>
        item.structural ||
        (
          item.similarity >= cfg.glideMin &&
          item.similarity <= cfg.glideMax &&
          item.intentSimilarity >= cfg.recommendationIntentMin &&
          item.broaderIntent
        )
      )
      .sort((a, b) =>
        Number(b.structural) - Number(a.structural) ||
        b.intentSimilarity - a.intentSimilarity ||
        b.similarity - a.similarity
      );
    if (candidates[0]) {
      const { structural, broaderIntent, ...recommended } = candidates[0];
      recommendations.push({
        ...recommended,
        reason: structural ? "route-hierarchy" : "semantic-broader-parent",
      });
    }
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
