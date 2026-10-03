import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeSemanticFlow,
  extractInternalLinks,
  extractPageSignals,
  semanticSimilarity,
} from "../src/lib/seo/astra-semantic-flow.mjs";

const page = (route, title, h1, description, body) => ({
  route,
  title,
  h1,
  description,
  indexable: true,
  tokens: extractPageSignals(`
    createFileRoute("${route}")
    export const Route = { head: () => ({ meta: [
      { title: "${title}" },
      { name: "description", content: "${description}" }
    ] }) }
    <h1>${h1}</h1><p>${body}</p>
  `, route).tokens,
  intentTokens: extractPageSignals(`
    createFileRoute("${route}")
    export const Route = { head: () => ({ meta: [
      { title: "${title}" },
      { name: "description", content: "${description}" }
    ] }) }
    <h1>${h1}</h1>
  `, route).intentTokens,
});

test("semantic similarity rewards shared topic while preserving lexical progression", () => {
  const parent = page(
    "/pronostics-sportifs",
    "Pronostics football",
    "Pronostics football",
    "Analyses et pronostics football",
    "football pronostic analyse match equipe cote forme calendrier"
  );
  const child = page(
    "/pronostics-sportifs/ligue-1",
    "Pronostics Ligue 1",
    "Pronostics Ligue 1",
    "Analyses des matchs de Ligue 1",
    "football pronostic analyse ligue france match equipe cote forme classement"
  );
  const unrelated = page(
    "/mentions-legales",
    "Mentions légales",
    "Mentions légales",
    "Informations juridiques",
    "editeur hebergeur responsabilite donnees droit applicable"
  );
  assert.ok(semanticSimilarity(parent.tokens, child.tokens) > semanticSimilarity(parent.tokens, unrelated.tokens));
});

test("extracts contextual internal anchor text", () => {
  const links = extractInternalLinks(
    '<p>Voir nos <a href="/pronostics-sportifs/ligue-1">pronostics Ligue 1</a> du jour.</p>',
    "/pronostics-sportifs"
  );
  assert.equal(links.length, 1);
  assert.equal(links[0].anchor, "pronostics ligue 1");
});

test("fault injection: duplicate search intent is detected as FAIL", () => {
  const a = page(
    "/pronostics-ligue-1",
    "Pronostics Ligue 1 aujourd'hui",
    "Pronostics Ligue 1",
    "Pronostics Ligue 1 et analyses",
    "pronostics ligue football france matchs analyses cotes equipes forme classement aujourd hui"
  );
  const b = page(
    "/conseils-ligue-1",
    "Pronostics Ligue 1 aujourd'hui",
    "Pronostics Ligue 1",
    "Pronostics Ligue 1 et analyses",
    "pronostics ligue football france matchs analyses cotes equipes forme classement aujourd hui"
  );
  const report = analyzeSemanticFlow([a, b], [], {
    cannibalizationThreshold: 0.9,
    intentCannibalizationThreshold: 0.9,
  });
  assert.equal(report.summary.verdict, "FAIL");
  assert.ok(report.findings.some((f) => f.code === "CANNIBALIZATION_HIGH"));
});

test("fault injection: strategic orphan is detected as FAIL", () => {
  const home = page("/", "BetGPT", "BetGPT", "Football", "football scores pronostics");
  const scores = page(
    "/scores-en-direct",
    "Scores en direct",
    "Scores football en direct",
    "Scores live",
    "football scores direct live matchs resultats equipes"
  );
  const report = analyzeSemanticFlow([home, scores], [], {
    strategicRoutes: ["/scores-en-direct"],
  });
  assert.equal(report.summary.verdict, "FAIL");
  assert.ok(report.findings.some((f) => f.code === "ORPHAN_PAGE" && f.status === "FAIL"));
});

test("semantic jump and generic anchor remain PARTIAL, not false hard failures", () => {
  const football = page(
    "/scores-en-direct",
    "Scores en direct",
    "Scores football en direct",
    "Scores live",
    "football scores direct live matchs resultats equipes"
  );
  const legal = page(
    "/mentions-legales",
    "Mentions légales",
    "Mentions légales",
    "Informations juridiques",
    "editeur hebergeur droit responsabilite donnees"
  );
  const report = analyzeSemanticFlow(
    [football, legal],
    [{ sourceRoute: "/scores-en-direct", targetRoute: "/mentions-legales", anchor: "cliquez ici" }],
    { semanticJumpThreshold: 0.2 }
  );
  assert.equal(report.summary.failures, 0);
  assert.equal(report.summary.verdict, "PARTIAL");
  assert.ok(report.findings.some((f) => f.code === "GENERIC_ANCHOR"));
});


test("dynamic template links satisfy inbound links for dynamic route families", () => {
  const hub = page(
    "/scores-en-direct",
    "Scores en direct",
    "Scores football en direct",
    "Scores live",
    "football scores direct live matchs resultats equipes"
  );
  const league = page(
    "/scores-en-direct/:league",
    "Scores Ligue",
    "Scores par championnat",
    "Scores live par championnat",
    "football scores direct ligue championnat matchs resultats"
  );
  const links = extractInternalLinks(
    '<Link to={\`/scores-en-direct/\${league.slug}\`}>Voir le championnat</Link>',
    "/scores-en-direct"
  );
  const report = analyzeSemanticFlow([hub, league], links, {
    strategicRoutes: ["/scores-en-direct/:league"],
  });
  assert.equal(report.summary.failures, 0);
  assert.equal(report.inbound["/scores-en-direct/:league"], 1);
});

test("parent recommendation refuses unrelated same-depth pages with weak intent overlap", () => {
  const bundesliga = page(
    "/bundesliga",
    "Bundesliga",
    "Bundesliga",
    "Championnat allemand",
    "football bundesliga allemagne matchs equipes classement buts"
  );
  const legal = page(
    "/cgu",
    "Conditions générales",
    "Conditions générales d'utilisation",
    "Règles juridiques",
    "editeur droit responsabilite donnees utilisateur service"
  );
  const report = analyzeSemanticFlow([bundesliga, legal], [], {
    recommendationIntentMin: 0.55,
  });
  assert.ok(!report.recommendations.some((r) => r.parent === "/bundesliga" && r.child === "/cgu"));
});
