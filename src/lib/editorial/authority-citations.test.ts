import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { contextualAuthorityGate, orderedContextualSourceIds } from "./authority-citations.ts";
import type { EditorialSource } from "./types.ts";

const official: EditorialSource = {
  id: "official",
  label: "Club",
  status: "OFFICIAL",
  note: "Communiqué",
  url: "https://club.example/communique",
};
const tier1: EditorialSource = {
  id: "tier1",
  label: "Reuters",
  status: "HIGH_CONFIDENCE",
  note: "Dépêche",
  url: "https://reuters.example/story",
};
const corroborated: EditorialSource = {
  id: "corroborated",
  label: "L'Équipe",
  status: "CORROBORATED",
  note: "Corroboration",
  url: "https://lequipe.example/story",
};

describe("ASTRA editorial authority citations", () => {
  it("puts official sources before journalistic corroboration", () => {
    assert.deepEqual(
      orderedContextualSourceIds(["corroborated", "official", "tier1"], [corroborated, official, tier1]),
      ["official", "tier1", "corroborated"],
    );
  });

  it("passes a news passage backed by an official source", () => {
    const gate = contextualAuthorityGate({
      articleType: "news",
      sources: [official],
      paragraphs: [{ h2: "Fait", body: "x".repeat(200), sourceIds: ["official"] }],
    });
    assert.equal(gate.pass, true);
  });

  it("passes without an official source only with two distinct strong external sources", () => {
    const gate = contextualAuthorityGate({
      articleType: "news",
      sources: [tier1, corroborated],
      paragraphs: [
        { h2: "Fait", body: "x".repeat(200), sourceIds: ["tier1"] },
        { h2: "Contexte", body: "y".repeat(200), sourceIds: ["corroborated"] },
      ],
    });
    assert.equal(gate.pass, true);
  });

  it("fails closed when a news passage has no contextual source", () => {
    const gate = contextualAuthorityGate({
      articleType: "news",
      sources: [official],
      paragraphs: [{ h2: "Fait", body: "x".repeat(200) }],
    });
    assert.equal(gate.pass, false);
    assert.match(gate.reasons.join(" | "), /sans source contextuelle/);
  });

  it("fails closed when only one non-official strong source supports the article", () => {
    const gate = contextualAuthorityGate({
      articleType: "news",
      sources: [tier1],
      paragraphs: [{ h2: "Fait", body: "x".repeat(200), sourceIds: ["tier1"] }],
    });
    assert.equal(gate.pass, false);
    assert.match(gate.reasons.join(" | "), /deux sources externes fortes/);
  });

  it("fails when an official source exists but the body never cites it", () => {
    const gate = contextualAuthorityGate({
      articleType: "news",
      sources: [official, tier1, corroborated],
      paragraphs: [
        { h2: "Fait", body: "x".repeat(200), sourceIds: ["tier1"] },
        { h2: "Contexte", body: "y".repeat(200), sourceIds: ["corroborated"] },
      ],
    });
    assert.equal(gate.pass, false);
    assert.match(gate.reasons.join(" | "), /officielle disponible/);
  });
});
