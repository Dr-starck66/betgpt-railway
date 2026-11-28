import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { inlineImageProof } from "./inline-image-proof.ts";

const photo = (src: string) => ({
  src, width: 1600, height: 900, alt: "Illustration du football dans un stade",
  caption: "Illustration, sans prétendre montrer le match.",
  credit: "Photographe exemple, licence à vérifier",
  sourceUrl: "https://commons.wikimedia.org/wiki/File:Example.jpg",
  licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
});
describe("native inline-image fail-closed structural proof", () => {
  it("rejects a cover alone", () => {
    const result = inlineImageProof({ image: photo("/cover.jpg"), paragraphs: [{h2:"a",body:"b"}] });
    assert.equal(result.pass, false);
  });
  it("rejects reuse of cover or duplicated image", () => {
    const result = inlineImageProof({ image: photo("/cover.jpg"), paragraphs: [
      {h2:"a",body:"b",inlineImage:photo("/cover.jpg")},
      {h2:"c",body:"d",inlineImage:photo("/cover.jpg")},
    ] });
    assert.equal(result.pass, false);
  });
  it("rejects missing per-file licensing", () => {
    const missing = {...photo("/a.jpg"),licenseUrl:undefined};
    const result = inlineImageProof({ image: photo("/cover.jpg"), paragraphs: [
      {h2:"a",body:"b",inlineImage:missing},
      {h2:"c",body:"d",inlineImage:photo("/b.jpg")},
    ] });
    assert.equal(result.pass, false);
  });
  it("accepts distinct well-formed metadata, without claiming independent rights verification", () => {
    const result = inlineImageProof({ image: photo("/cover.jpg"), paragraphs: [
      {h2:"a",body:"b",inlineImage:photo("/a.jpg")},
      {h2:"c",body:"d",inlineImage:photo("/b.jpg")},
    ] });
    assert.equal(result.pass, true);
    assert.equal(result.count, 2);
  });
});
