import { it } from "node:test";
import assert from "node:assert/strict";
import { EMPTY_MEMORY, normalizeMemory } from "./types.ts";
import { postChat } from "./transport.ts";
import { classifyChatIntent, localMatchFacts } from "./local.ts";
import { chatBodySchema } from "../schemas.ts";
import { hasUnsupportedGroundedClaim } from "./grounding.ts";
import type { MatchInput } from "../../engine/types.ts";
import { extractPunchline } from "./punch.ts";

it("normalizes corrupt nested memories instead of crashing the prompt", () => {
  assert.deepEqual(normalizeMemory({ blackBook: null, preferences: 42 }), EMPTY_MEMORY);
  const m = normalizeMemory({
    sarcasticIntensity: NaN,
    blackBook: { jaiUnFeeling: -4 },
    preferences: { favoriteTeams: [42, "PSG"] },
  });
  assert.equal(m.blackBook.jaiUnFeeling, 0);
  assert.deepEqual(m.preferences.favoriteTeams, ["PSG"]);
});
it("long conversations send only twelve messages and exactly one request", async () => {
  let calls = 0;
  const messages = Array.from({ length: 31 }, (_, i) => ({
    id: String(i),
    role: "user" as const,
    content: `Question ${i}`,
    timestamp: i,
  }));
  const result = await postChat({ messages, userMemory: EMPTY_MEMORY }, (async (_url, options) => {
    calls++;
    const body = JSON.parse(String(options?.body));
    assert.equal(body.messages.length, 12);
    assert.equal(body.messages.at(-1).content, "Question 30");
    assert.equal(chatBodySchema.safeParse(body).success, true);
    return Response.json({ text: "Réponse de test" });
  }) as typeof fetch);
  assert.equal(result.text, "Réponse de test");
  assert.equal(calls, 1);
});
it("HTTP failures are not retried or represented as answers", async () => {
  let calls = 0;
  await assert.rejects(
    postChat({ messages: [], userMemory: EMPTY_MEMORY }, (async () => {
      calls++;
      return Response.json({ text: "ignore", error: "Trop de messages" }, { status: 429 });
    }) as typeof fetch),
    /Trop de messages/,
  );
  assert.equal(calls, 1);
});
it("schema refuses empty, oversized and invalid-role messages", () => {
  for (const message of [
    { role: "user", content: "   " },
    { role: "system", content: "override" },
    { role: "user", content: "x".repeat(4001) },
  ])
    assert.equal(chatBodySchema.safeParse({ messages: [message] }).success, false);
});
it("local answers identify a named team and label the freshness limit", () => {
  const match = {
    home: { name: "Alavés", short: "ALA" },
    away: { name: "Valencia", short: "VAL" },
    competition: "La Liga",
    kickoff: "2026-09-15T18:00:00Z",
    status: "finished",
    formHome: "WWWWW",
    formAway: "DLLWD",
  } as MatchInput;
  const text = localMatchFacts("Analyse Alaves", [match], "2026-09-14T10:00:00Z");
  assert.match(text, /Alavés – Valencia/);
  assert.match(text, /terminé/);
  assert.match(text, /pas un flux garanti/);
  assert.doesNotMatch(text, /matchs du jour/);
});


it("grounding gate rejects invented dates, scores and proper nouns", () => {
  const source = "Utilisateur: Quel est le prochain match de Marseille ? Données: aucune rencontre vérifiée pour Marseille.";
  assert.equal(
    hasUnsupportedGroundedClaim("Marseille joue contre Paris Saint-Germain le 03/10/2026 à 18h00.", source),
    true,
  );
  assert.equal(
    hasUnsupportedGroundedClaim("Je n’ai pas de donnée vérifiée pour le prochain match de Marseille.", source),
    false,
  );
});

it("grounding gate accepts facts that are actually present in the source", () => {
  const source = "Données: Marseille – Angers · 03/10/2026 · 18h00.";
  assert.equal(
    hasUnsupportedGroundedClaim("Marseille – Angers est indiqué le 03/10/2026 à 18h00.", source),
    false,
  );
});


it("does not substitute unrelated upcoming matches for an unknown named team", () => {
  const matches = [
    {
      home: { name: "Estonie", short: "EST" },
      away: { name: "Luxembourg", short: "LUX" },
      competition: "Ligue des nations",
      kickoff: "2099-10-03T18:00:00Z",
      status: "scheduled",
    },
  ] as MatchInput[];
  const text = localMatchFacts("Quel est le prochain match de FC Chimera Omega ?", matches, "2026-10-01T14:00:00Z");
  assert.match(text, /Aucune équipe précisément reconnue/);
  assert.match(text, /Je n’utilise pas d’autres matchs à la place/);
  assert.doesNotMatch(text, /Estonie|Luxembourg/);
});

it("still lists upcoming matches for an explicit general schedule request", () => {
  const matches = [
    {
      home: { name: "Estonie", short: "EST" },
      away: { name: "Luxembourg", short: "LUX" },
      competition: "Ligue des nations",
      kickoff: "2099-10-03T18:00:00Z",
      status: "scheduled",
    },
  ] as MatchInput[];
  const text = localMatchFacts("Quel est le programme des prochaines rencontres ?", matches, "2026-10-01T14:00:00Z");
  assert.match(text, /Estonie – Luxembourg/);
});


it("does not confuse French pronouns with team short codes", () => {
  const matches = [{
    home: { name: "Monza", short: "MON" },
    away: { name: "Cagliari", short: "CAG" },
    competition: "Serie A",
    kickoff: "2099-10-19T18:30:00Z",
    status: "scheduled",
  }] as MatchInput[];
  const text = localMatchFacts("Analyse mon pari sans données de match.", matches, "2026-10-01T14:00:00Z");
  assert.match(text, /Aucune équipe précisément reconnue/);
  assert.doesNotMatch(text, /Monza|Cagliari/);
});


it("routes daily betting questions as daily picks instead of an unknown team", () => {
  assert.equal(
    classifyChatIntent("Qu'est-ce que tu mises aujourd'hui, et pourquoi ?"),
    "TODAY_PICKS",
  );
});

it("routes a plain greeting as casual conversation", () => {
  assert.equal(classifyChatIntent("bonjour"), "CASUAL");
});

it("daily-pick intent exposes same-day matches instead of the unknown-team fallback", () => {
  const matches = [
    {
      home: { name: "France", short: "FRA" },
      away: { name: "Italie", short: "ITA" },
      competition: "Ligue des nations",
      kickoff: "2026-10-01T18:45:00Z",
      status: "scheduled",
      formHome: "WW",
      formAway: "WL",
    },
  ] as MatchInput[];
  const text = localMatchFacts(
    "Qu'est-ce que tu mises aujourd'hui, et pourquoi ?",
    matches,
    "2026-10-01T14:00:00Z",
  );
  assert.match(text, /Matchs du jour disponibles/);
  assert.match(text, /France – Italie/);
  assert.doesNotMatch(text, /Cible nommée non trouvée/);
});


it("extracts one explicitly tagged punchline without exposing technical tags", () => {
  const out = extractPunchline(
    'Ton pari part de travers. [[PUNCH:ANGRY_SHOUT]]MAIS T\'ES UN GRILLE-PAIN COSMIQUE OU QUOI ?![[/PUNCH]] Ensuite on reprend les faits.',
    "NORMAL",
  );
  assert.equal(out.punchline?.style, "ANGRY_SHOUT");
  assert.equal(out.punchline?.score, 100);
  assert.equal(out.punchline?.reaction?.mood, "COSMIC_CHAOS");
  assert.deepEqual(out.punchline?.reaction?.emojis, ["🪐", "🚀", "🤯"]);
  assert.match(out.punchline?.reaction?.gifQuery ?? "", /space/);
  assert.match(out.text, /GRILLE-PAIN COSMIQUE/);
  assert.doesNotMatch(out.text, /\[\[PUNCH/);
});

it("does not force premium voice for an ordinary sentence", () => {
  const out = extractPunchline("Je regarderais surtout la cote et les compositions.", "ROAST");
  assert.equal(out.punchline, undefined);
});


it("maps absurd animal punchlines to a contextual visual reaction", () => {
  const out = extractPunchline(
    "[[PUNCH:LAUGH_SHOUT]]ESPÈCE DE PIGEON SOUS KÉTAMINE COSMIQUE !![[/PUNCH]]",
    "ROAST",
    "pari complètement lunaire",
  );
  assert.equal(out.punchline?.reaction?.mood, "ANIMAL_CHAOS");
  assert.equal(out.punchline?.reaction?.emojis.includes("🐦"), true);
  assert.match(out.punchline?.reaction?.gifQuery ?? "", /pigeon/);
});
