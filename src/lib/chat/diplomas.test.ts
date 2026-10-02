import { describe, expect, it } from "vitest";
import { EMPTY_MEMORY } from "./types";
import { selectChatDiploma } from "./diplomas";

describe("chat diplomas", () => {
  it("awards the survival diploma for an all-in", () => {
    expect(selectChatDiploma({
      userText: "Je mets tout en all-in sur ce match",
      assistantText: "Réduis la mise.",
      memory: EMPTY_MEMORY,
      mode: "ROAST",
    })).toBe("D10");
  });

  it("awards the combiné diploma for a huge accumulator", () => {
    expect(selectChatDiploma({
      userText: "Mon combiné 15 matchs a perdu sur le dernier match",
      assistantText: "Le dernier match a détruit ton ticket.",
      memory: EMPTY_MEMORY,
      mode: "ROAST",
    })).toBe("D09");
  });

  it("awards the certainty diploma for impossible-to-lose claims", () => {
    expect(selectChatDiploma({
      userText: "J'étais sûr à 100 %, impossible de perdre",
      assistantText: "Et pourtant.",
      memory: EMPTY_MEMORY,
      mode: "ROAST",
    })).toBe("D05");
  });

  it("does not award a diploma for a neutral football question", () => {
    expect(selectChatDiploma({
      userText: "Qui joue ce soir en Ligue 1 ?",
      assistantText: "Voici les affiches.",
      memory: EMPTY_MEMORY,
      mode: "NORMAL",
    })).toBeUndefined();
  });
});
