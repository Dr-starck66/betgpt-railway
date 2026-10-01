import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { rewriteCanonicalOg, CANONICAL_OG_IMAGE, CANONICAL_ORIGIN } from "./canonical-og.mjs";

describe("canonical OG rewrite", () => {
  it("replaces grok.me og:image and copies document title/description", () => {
    const html = `<!DOCTYPE html><html lang="fr"><head><title>Pronostic Bayern Munich : analyse et score probable | BetGPT</title><meta name="description" content="Bayern est favori assez net."/><meta property="og:title" content="BetGPT"><meta property="og:description" content="Desk"><meta property="og:image" content="https://star-heart-iris-dove.grok.me/og.jpg"></head><body></body></html>`;
    const out = rewriteCanonicalOg(html);
    assert.match(out, new RegExp(`property="og:image" content="${CANONICAL_OG_IMAGE}"`));
    assert.match(out, new RegExp(`name="twitter:image" content="${CANONICAL_OG_IMAGE}"`));
    assert.doesNotMatch(out, /grok\.me\/og/);
    assert.match(out, /property="og:title" content="Pronostic Bayern Munich : analyse et score probable \| BetGPT"/);
    assert.match(out, /property="og:description" content="Bayern est favori assez net."/);
    assert.match(out, /property="og:url" content="https:\/\/betgpt\.live"/);
  });

  it("preserves a route-specific article image", () => {
    const articleImage = "https://betgpt.live/blog/discover/inline-live.jpg";
    const html = `<!DOCTYPE html><html><head><title>Article | BetGPT</title><meta property="og:image" content="${articleImage}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="675"><meta name="twitter:image" content="${articleImage}"></head><body></body></html>`;
    const out = rewriteCanonicalOg(html);
    assert.match(out, new RegExp(`property="og:image" content="${articleImage}"`));
    assert.match(out, new RegExp(`name="twitter:image" content="${articleImage}"`));
    assert.match(out, /property="og:image:height" content="675"/);
  });

  it("injects og:image when the PWA injector omitted it", () => {
    const html = `<!DOCTYPE html><html lang="fr"><head><title>Scores | BetGPT</title></head><body></body></html>`;
    const out = rewriteCanonicalOg(html);
    assert.match(out, new RegExp(`property="og:image" content="${CANONICAL_OG_IMAGE}"`));
    assert.match(out, new RegExp(`name="twitter:image" content="${CANONICAL_OG_IMAGE}"`));
    assert.match(out, new RegExp(`property="og:url" content="${CANONICAL_ORIGIN}"`));
  });

  it("copies the page canonical into og:url", () => {
    const html = `<!DOCTYPE html><html><head><title>Pronostic x | BetGPT</title><link rel="canonical" href="https://betgpt.live/match/bayern-munich-1-fc-union-berlin-2026-09-18"></head><body></body></html>`;
    const out = rewriteCanonicalOg(html);
    assert.match(out, /property="og:url" content="https:\/\/betgpt\.live\/match\/bayern-munich-1-fc-union-berlin-2026-09-18"/);
    assert.match(out, new RegExp(`property="og:image" content="${CANONICAL_OG_IMAGE}"`));
  });

  it("leaves non-HTML untouched", () => {
    assert.equal(rewriteCanonicalOg("User-agent: *"), "User-agent: *");
  });
});
