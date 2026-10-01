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

describe("ASTRA Editorial Authority Guard", () => {
  it("orders official, tier-1, then corroborated sources", () => {
    assert.deepEqual(
      orderedContextualSourceIds(
        ["corroborated", "official", "tier1"],
        [corroborated, official, tier1],
      ),
      ["official", "tier1", "corroborated"],
    );
  });

  it("accepts one official source when every news block is traceable", () => {
    const gate = contextualAuthorityGate({
      articleType: "news",
      sources: [official],
      paragraphs: [
        {
          h2: "Fait",
          body: "x".repeat(200),
          sourceIds: ["official"],
          subsections: [
            {
              h3: "Détail",
              body: "y".repeat(180),
              sourceIds: ["official"],
            },
          ],
        },
      ],
    });
    assert.equal(gate.pass, true);
  });

  it("accepts two distinct strong sources when no official source exists", () => {
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

  it("fails closed on an uncited nested H3", () => {
    const gate = contextualAuthorityGate({
      articleType: "news",
      sources: [official],
      paragraphs: [
        {
          h2: "Fait",
          body: "x".repeat(200),
          sourceIds: ["official"],
          subsections: [{ h3: "Détail", body: "y".repeat(180) }],
        },
      ],
    });
    assert.equal(gate.pass, false);
    assert.match(gate.reasons.join(" | "), /H3 .* sans source contextuelle/);
  });

  it("fails closed when one non-official source is the only strong evidence", () => {
    const gate = contextualAuthorityGate({
      articleType: "news",
      sources: [tier1],
      paragraphs: [{ h2: "Fait", body: "x".repeat(200), sourceIds: ["tier1"] }],
    });
    assert.equal(gate.pass, false);
    assert.match(gate.reasons.join(" | "), /deux sources externes fortes/);
  });

  it("fails when an official source exists but is never cited in the body", () => {
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
