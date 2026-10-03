import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeSemanticFlow,
  extractAutoRepairLinks,
  extractPageSignals,
} from "../src/lib/seo/astra-semantic-flow.mjs";
import {
  planSemanticRepairs,
  renderSemanticAutoLinks,
} from "../src/lib/seo/astra-semantic-autorepair.mjs";

function page(route, title, body = "") {
  const source =
    'createFileRoute("' +
    route +
    '")({ head:()=>({meta:[{title:"' +
    title +
    '"},{name:"description",content:"' +
    title +
    ' football analyse pronostic scores"}]}), component:()=> <><h1>' +
    title +
    "</h1><p>" +
    body +
    "</p></> })";
  return extractPageSignals(source, route);
}

test("orphan with explicit deterministic parent is auto-repaired", () => {
  const parent = page("/guides", "Guides football", "football guide analyse pronostic");
  const child = page("/guides/value-bet", "Guide value bet", "football guide cote value bet analyse");
  const before = analyzeSemanticFlow([parent, child], [], {
    parentHints: { "/guides/value-bet": "/guides" },
    strategicRoutes: ["/guides/value-bet"],
    semanticJumpThreshold: 0.01,
  });
  assert.equal(before.summary.verdict, "FAIL");

  const plan = planSemanticRepairs(before, [parent, child], {
    parentHints: { "/guides/value-bet": "/guides" },
    semanticJumpThreshold: 0.01,
  });

  assert.equal(plan.actions.length, 1);
  assert.equal(plan.actions[0].source, "/guides");
  assert.equal(plan.actions[0].target, "/guides/value-bet");

  const registry = renderSemanticAutoLinks(plan.actions);
  const repairedLinks = extractAutoRepairLinks(registry);
  const after = analyzeSemanticFlow([parent, child], repairedLinks, {
    parentHints: { "/guides/value-bet": "/guides" },
    strategicRoutes: ["/guides/value-bet"],
    semanticJumpThreshold: 0.01,
  });

  assert.equal(after.summary.failures, 0);
  assert.ok(!after.findings.some((f) => f.code === "ORPHAN_PAGE"));
});

test("route hierarchy repairs a static orphan without guessing a semantic parent", () => {
  const parent = page("/blog", "Blog football", "football actualite analyse");
  const child = page("/blog/cotes-football", "Cotes football", "football cotes analyse marche");
  const before = analyzeSemanticFlow([parent, child], [], {
    strategicRoutes: ["/blog/cotes-football"],
    semanticJumpThreshold: 0.01,
  });
  const plan = planSemanticRepairs(before, [parent, child], {
    semanticJumpThreshold: 0.01,
  });
  assert.equal(plan.actions.length, 1);
  assert.equal(plan.actions[0].reason, "route-hierarchy");
});

test("generic anchor gets a descriptive supplemental link and the warning disappears", () => {
  const source = page("/pronostics", "Pronostics football", "football pronostics cotes");
  const target = page("/methodology", "Méthodologie BetGPT", "football methode modele probabilite");
  const weak = [{ sourceRoute: "/pronostics", targetRoute: "/methodology", anchor: "cliquez ici" }];

  const before = analyzeSemanticFlow([source, target], weak, {
    semanticJumpThreshold: 0,
  });
  assert.ok(before.findings.some((f) => f.code === "GENERIC_ANCHOR"));

  const plan = planSemanticRepairs(before, [source, target], {
    semanticJumpThreshold: 0,
  });
  assert.equal(plan.actions.length, 1);

  const registry = renderSemanticAutoLinks(plan.actions);
  const after = analyzeSemanticFlow(
    [source, target],
    [...weak, ...extractAutoRepairLinks(registry)],
    { semanticJumpThreshold: 0 }
  );

  assert.ok(!after.findings.some((f) => f.code === "GENERIC_ANCHOR"));
});

test("cannibalization is blocked and never auto-mutated", () => {
  const a = page("/pronostics-ligue-1", "Pronostics Ligue 1", "football ligue 1 pronostics");
  const b = page("/conseils-ligue-1", "Pronostics Ligue 1", "football ligue 1 pronostics");
  const report = analyzeSemanticFlow([a, b], [], {
    cannibalizationThreshold: 0.8,
    intentCannibalizationThreshold: 0.8,
  });
  const plan = planSemanticRepairs(report, [a, b], {});
  assert.equal(plan.actions.length, 0);
  assert.equal(plan.blocked.length, 1);
  assert.equal(plan.summary.status, "BLOCKED");
});

test("semantic jump is suggestion-only, not an automatic link mutation", () => {
  const football = page("/scores", "Scores football", "football scores matchs");
  const legal = page("/cgu", "Conditions générales", "droit responsabilite donnees");
  const report = analyzeSemanticFlow(
    [football, legal],
    [{ sourceRoute: "/scores", targetRoute: "/cgu", anchor: "conditions générales" }],
    { semanticJumpThreshold: 0.9 }
  );
  assert.ok(report.findings.some((f) => f.code === "SEMANTIC_JUMP"));
  const plan = planSemanticRepairs(report, [football, legal], {});
  assert.equal(plan.actions.length, 0);
  assert.ok(plan.suggestions.some((x) => x.code === "SEMANTIC_JUMP"));
});

test("dynamic orphan is never repaired with a fake colon URL", () => {
  const hub = page("/scores-en-direct", "Scores en direct", "football score live");
  const dynamic = page("/scores-en-direct/:league", "Scores championnat", "football score ligue");
  const report = analyzeSemanticFlow([hub, dynamic], [], {
    strategicRoutes: ["/scores-en-direct/:league"],
  });
  const plan = planSemanticRepairs(report, [hub, dynamic], {
    parentHints: { "/scores-en-direct/:league": "/scores-en-direct" },
  });
  assert.equal(plan.actions.length, 0);
  assert.ok(plan.suggestions.some((x) => x.reason === "dynamic-or-unresolved-route"));
});

test("registry generation is deterministic and idempotent", () => {
  const actions = [
    {
      source: "/b",
      target: "/c",
      anchor: "C",
      relation: "child",
      reason: "route-hierarchy",
    },
    {
      source: "/a",
      target: "/b",
      anchor: "B",
      relation: "child",
      reason: "route-hierarchy",
    },
  ];
  const first = renderSemanticAutoLinks(actions);
  const second = renderSemanticAutoLinks(actions.slice().reverse());
  assert.equal(first, second);
  assert.equal(extractAutoRepairLinks(first).length, 2);
});
