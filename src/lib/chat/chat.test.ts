import { it } from "node:test";
import assert from "node:assert/strict";
import { EMPTY_MEMORY, normalizeMemory } from "./types.ts";
import { postChat } from "./transport.ts";
import { localMatchFacts } from "./local.ts";
import { chatBodySchema } from "../schemas.ts";
import type { MatchInput } from "../../engine/types.ts";

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
  assert.equal(result, "Réponse de test");
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
