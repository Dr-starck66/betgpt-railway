import assert from "node:assert/strict";
import { test } from "node:test";
import {
  classifySearchReferrer,
  isHumanSearchLandingRequest,
  SEARCH_TRUTH_AVAILABILITY,
} from "./search-truth.ts";

test("classifies real search referrers without reading query strings", () => {
  assert.equal(classifySearchReferrer("https://www.google.fr/search?q=betgpt"), "google");
  assert.equal(classifySearchReferrer("https://www.bing.com/search?q=betgpt"), "bing");
  assert.equal(classifySearchReferrer("https://duckduckgo.com/?q=betgpt"), "duckduckgo");
  assert.equal(classifySearchReferrer("https://example.com/page"), null);
});

test("accepts human document landings and rejects bots/assets", () => {
  assert.equal(isHumanSearchLandingRequest({ method: "GET", pathname: "/pronostics-football", userAgent: "Mozilla/5.0", secFetchDest: "document" }), true);
  assert.equal(isHumanSearchLandingRequest({ method: "GET", pathname: "/assets/app.js", userAgent: "Mozilla/5.0", secFetchDest: "script" }), false);
  assert.equal(isHumanSearchLandingRequest({ method: "GET", pathname: "/", userAgent: "Googlebot", secFetchDest: "document" }), false);
});

test("never claims unavailable Search Console metrics", () => {
  assert.equal(SEARCH_TRUTH_AVAILABILITY.queries, "UNAVAILABLE");
  assert.equal(SEARCH_TRUTH_AVAILABILITY.serpImpressions, "UNAVAILABLE");
  assert.equal(SEARCH_TRUTH_AVAILABILITY.serpCtr, "UNAVAILABLE");
  assert.equal(SEARCH_TRUTH_AVAILABILITY.organicLandings, "MEASURED");
});
