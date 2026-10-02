import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EMPTY_MEMORY } from "./types";
import { selectChatDiploma } from "./diplomas";

describe("chat diplomas", () => {
  it("awards the survival diploma for an all-in", () => {
    assert.equal(selectChatDiploma({
      userText: "Je mets tout en all-in sur ce match",
      assistantText: "Réduis la mise.",
      memory: EMPTY_MEMORY,
      mode: "ROAST",
    }), "D10");
  });

  it("awards the combiné diploma for a huge accumulator", () => {
    assert.equal(selectChatDiploma({
      userText: "Mon combiné 15 matchs a perdu sur le dernier match",
      assistantText: "Le dernier match a détruit ton ticket.",
      memory: EMPTY_MEMORY,
      mode: "ROAST",
    }), "D09");
  });

  it("awards the certainty diploma for impossible-to-lose claims", () => {
    assert.equal(selectChatDiploma({
      userText: "J'étais sûr à 100 %, impossible de perdre",
      assistantText: "Et pourtant.",
      memory: EMPTY_MEMORY,
      mode: "ROAST",
    }), "D05");
  });

  it("does not award a diploma for a neutral football question", () => {
    assert.equal(selectChatDiploma({
      userText: "Qui joue ce soir en Ligue 1 ?",
      assistantText: "Voici les affiches.",
      memory: EMPTY_MEMORY,
      mode: "NORMAL",
    }), undefined);
  });
});
