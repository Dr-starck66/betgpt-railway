import { it } from "node:test";
import assert from "node:assert/strict";
import { EMPTY_MEMORY } from "./types.ts";
import { selectChatDiploma, type ChatDiplomaId } from "./diplomas.ts";

it("all-in chooses a relevant diploma", () => {
  const result = selectChatDiploma({
    userText: "Je mets tout en all-in sur ce match",
    assistantText: "Réduis la mise.",
    memory: EMPTY_MEMORY,
    mode: "ROAST",
  });
  assert.ok(["D10", "D03", "D01", "D05"].includes(result ?? ""));
});

it("huge combiné chooses a relevant diploma", () => {
  const result = selectChatDiploma({
    userText: "Mon combiné 15 matchs a perdu sur le dernier match",
    assistantText: "Le dernier match a détruit ton ticket.",
    memory: EMPTY_MEMORY,
    mode: "ROAST",
  });
  assert.ok(["D09", "D03", "D01", "D07", "D02"].includes(result ?? ""));
});

it("recent diplomas are excluded when another relevant diploma exists", () => {
  const recent: ChatDiplomaId[] = ["D10", "D03", "D01"];
  const result = selectChatDiploma({
    userText: "Je mets tout en all-in, c'est sûr à 100 %",
    assistantText: "Magnifique idée si ton but est d'effrayer ta bankroll.",
    memory: EMPTY_MEMORY,
    mode: "ROAST",
    recent,
  });
  assert.ok(result);
  assert.equal(recent.includes(result!), false);
});

it("rotates repeated context as recent history changes", () => {
  const base = {
    userText: "Mon combiné 12 matchs est sûr à 100 %, je mets tout.",
    assistantText: "La bankroll cherche déjà la sortie.",
    memory: EMPTY_MEMORY,
    mode: "ROAST" as const,
  };
  const a = selectChatDiploma(base);
  assert.ok(a);
  const b = selectChatDiploma({ ...base, recent: [a!] });
  assert.ok(b);
  assert.notEqual(b, a);
});

it("does not award a diploma for a neutral football question", () => {
  assert.equal(selectChatDiploma({
    userText: "Qui joue ce soir en Ligue 1 ?",
    assistantText: "Voici les affiches.",
    memory: EMPTY_MEMORY,
    mode: "NORMAL",
  }), undefined);
});
