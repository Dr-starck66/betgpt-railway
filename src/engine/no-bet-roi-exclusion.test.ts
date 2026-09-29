import test from "node:test";
import assert from "node:assert/strict";
import { isRoiEligibleDecision } from "./roi-eligibility.ts";

test("NO_BET is never ROI-eligible", () => {
  assert.equal(isRoiEligibleDecision("NO_BET"), false);
});

test("actual wager decisions remain ROI-eligible", () => {
  assert.equal(isRoiEligibleDecision("BET"), true);
  assert.equal(isRoiEligibleDecision("WATCH"), true);
});
