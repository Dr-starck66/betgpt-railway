import { normalizeText, semanticSimilarity } from "./astra-semantic-flow.mjs";

function cleanLabel(value = "") {
  return String(value)
    .replace(/\s*[|·–—-]\s*BetGPT.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** @param {any} page */
export function descriptiveAnchor(page = {}) {
  const raw = cleanLabel(page.h1 || page.title || "");
  if (raw && normalizeText(raw).length >= 4) return raw;
  const route = String(page.route || "")
    .replace(/^\//, "")
    .replace(/[:_/-]+/g, " ")
    .trim();
  if (!route) return "Accueil BetGPT";
  return route.replace(/\b\w/g, (m) => m.toUpperCase());
}

export function isStaticRoute(route = "") {
  return Boolean(route) && !String(route).includes(":") && !String(route).includes("$" + "{");
}

/** @param {string} route @param {Map<string, any>} pageByRoute */
function parentFromHierarchy(route, pageByRoute) {
  if (!isStaticRoute(route) || route === "/") return "";
  const parts = route.split("/").filter(Boolean);
  while (parts.length > 1) {
    parts.pop();
    const candidate = "/" + parts.join("/");
    if (pageByRoute.has(candidate) && isStaticRoute(candidate)) return candidate;
  }
  return "";
}

/** @param {any} action */
function actionKey(action) {
  return [action.type, action.source, action.target, normalizeText(action.anchor)].join("|");
}

/** @param {any} report @param {any[]} pages @param {any} config */
export function planSemanticRepairs(report, pages = [], config = {}) {
  /** @type {any} */
  const cfg = {
    semanticJumpThreshold: 0.09,
    parentHints: {},
    autoRepairGenericAnchors: true,
    ...config,
  };
  /** @type {Map<string, any>} */
  const pageByRoute = new Map(
    pages.filter((page) => page?.indexable && page?.route).map((page) => [page.route, page])
  );
  /** @type {any[]} */
  const actions = [];
  /** @type {any[]} */
  const suggestions = [];
  /** @type {any[]} */
  const blocked = [];

  for (const finding of report?.findings || []) {
    if (finding.code === "CANNIBALIZATION_HIGH") {
      blocked.push({
        code: finding.code,
        routes: finding.routes,
        reason: "unsafe-content-decision",
        message: "Fusion, canonicalisation ou différenciation éditoriale requise: aucune mutation automatique.",
      });
      continue;
    }

    if (finding.code === "SEMANTIC_JUMP") {
      suggestions.push({
        code: finding.code,
        routes: finding.routes,
        reason: "ambiguous-semantic-distance",
        message: "Relation à revoir manuellement: aucune mutation automatique.",
      });
      continue;
    }

    if (finding.code === "ORPHAN_PAGE") {
      const childRoute = finding.routes?.[0] || "";
      const child = pageByRoute.get(childRoute);
      if (!child || !isStaticRoute(childRoute)) {
        suggestions.push({
          code: finding.code,
          routes: finding.routes,
          reason: "dynamic-or-unresolved-route",
          message: "Page orpheline non statique: nécessite une source de liens rendus ou un parent explicite.",
        });
        continue;
      }

      const hinted = cfg.parentHints?.[childRoute];
      const parentRoute =
        (hinted && pageByRoute.has(hinted) && isStaticRoute(hinted) ? hinted : "") ||
        parentFromHierarchy(childRoute, pageByRoute);
      const parent = pageByRoute.get(parentRoute);

      if (!parent) {
        suggestions.push({
          code: finding.code,
          routes: finding.routes,
          reason: "no-deterministic-parent",
          message: "Aucun parent déterministe trouvé: pas de lien inventé.",
        });
        continue;
      }

      const similarity = semanticSimilarity(parent.tokens, child.tokens);
      if (similarity < cfg.semanticJumpThreshold) {
        suggestions.push({
          code: finding.code,
          routes: [parentRoute, childRoute],
          reason: "parent-too-far-semantically",
          message: "Parent déterministe trouvé mais distance sémantique trop grande (score=" + similarity + ").",
        });
        continue;
      }

      actions.push({
        type: "ADD_CONTEXTUAL_EDGE",
        source: parentRoute,
        target: childRoute,
        anchor: descriptiveAnchor(child),
        relation: "child",
        confidence: "HIGH",
        reason: hinted ? "configured-parent-hint" : "route-hierarchy",
        similarity,
      });
      continue;
    }

    if (finding.code === "GENERIC_ANCHOR" && cfg.autoRepairGenericAnchors) {
      const [sourceRoute = "", targetRoute = ""] = finding.routes || [];
      const source = pageByRoute.get(sourceRoute);
      const target = pageByRoute.get(targetRoute);
      if (!source || !target || !isStaticRoute(sourceRoute) || !isStaticRoute(targetRoute)) {
        suggestions.push({
          code: finding.code,
          routes: finding.routes,
          reason: "dynamic-or-unresolved-anchor",
          message: "Ancre générique sur route non statique: pas de mutation automatique.",
        });
        continue;
      }
      actions.push({
        type: "ADD_CONTEXTUAL_EDGE",
        source: sourceRoute,
        target: targetRoute,
        anchor: descriptiveAnchor(target),
        relation: "contextual",
        confidence: "HIGH",
        reason: "replace-generic-anchor-safely",
        similarity: semanticSimilarity(source.tokens, target.tokens),
      });
    }
  }

  /** @type {any[]} */
  const deduped = [];
  /** @type {Set<string>} */
  const seen = new Set();
  for (const action of actions) {
    const key = actionKey(action);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(action);
  }

  return {
    summary: {
      actions: deduped.length,
      suggestions: suggestions.length,
      blocked: blocked.length,
      status: blocked.length ? "BLOCKED" : suggestions.length ? "PARTIAL" : "PASS",
    },
    actions: deduped,
    suggestions,
    blocked,
  };
}

/** @param {any[]} actions */
export function renderSemanticAutoLinks(actions = []) {
  const rows = [...actions]
    .sort((a, b) =>
      String(a.source).localeCompare(String(b.source)) ||
      String(a.target).localeCompare(String(b.target)) ||
      String(a.anchor).localeCompare(String(b.anchor))
    )
    .map((action) => {
      const row = {
        source: action.source,
        href: action.target,
        anchor: action.anchor,
        relation: action.relation || "contextual",
        reason: action.reason || "auto-repair",
      };
      return "  " + JSON.stringify(row) + ",";
    })
    .join("\n");

  return [
    "/* AUTO-GENERATED by ASTRA SEMANTIC FLOW AUTO-REPAIR Ω. DO NOT EDIT BY HAND. */",
    "export type SemanticAutoLink = {",
    "  source: string;",
    "  href: string;",
    "  anchor: string;",
    "  relation: \"child\" | \"contextual\";",
    "  reason: string;",
    "};",
    "",
    "export const SEMANTIC_AUTO_LINKS: SemanticAutoLink[] = [",
    rows,
    "];",
    "",
  ].join("\n");
}
