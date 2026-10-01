import test from "node:test";
import assert from "node:assert/strict";
import {
  assertRequestedModelAuthorized,
  buildAstraModelMaxPlan,
  modelScore,
  type AstraModelDescriptor,
} from "./astra-model-max";

const model = (
  id: string,
  provider: string,
  values: Partial<AstraModelDescriptor> = {},
): AstraModelDescriptor => ({
  id,
  provider,
  authorized: true,
  availability: "available",
  quality: 80,
  reasoning: 80,
  tools: 80,
  reliability: 80,
  latency: 40,
  cost: 40,
  ...values,
});

test("never selects an unauthorized model even when its quality is highest", () => {
  const catalog = [
    model("hidden-supermodel", "internal", {
      authorized: false,
      quality: 100,
      reasoning: 100,
      reliability: 100,
    }),
    model("authorized-best", "provider-a", { quality: 92, reasoning: 95 }),
  ];
  const plan = buildAstraModelMaxPlan(catalog, "critical");
  assert.equal(plan.primary?.id, "authorized-best");
});

test("unavailable models are excluded", () => {
  const catalog = [
    model("offline-best", "provider-a", {
      availability: "unavailable",
      quality: 100,
      reasoning: 100,
    }),
    model("online", "provider-b", { quality: 88 }),
  ];
  assert.equal(buildAstraModelMaxPlan(catalog, "critical").primary?.id, "online");
});

test("critical profile prefers quality and reasoning over latency", () => {
  const strong = model("strong", "provider-a", {
    quality: 98,
    reasoning: 98,
    reliability: 95,
    latency: 90,
  });
  const fast = model("fast", "provider-b", {
    quality: 70,
    reasoning: 65,
    reliability: 88,
    latency: 5,
  });
  assert.ok(modelScore(strong, "critical") > modelScore(fast, "critical"));
});

test("critical plan uses an independent critic when available", () => {
  const plan = buildAstraModelMaxPlan(
    [
      model("primary", "provider-a", { quality: 95, reasoning: 95 }),
      model("critic", "provider-b", { quality: 90, reasoning: 92 }),
      model("fallback", "provider-a", { quality: 82 }),
    ],
    "critical",
  );
  assert.equal(plan.status, "PASS");
  assert.equal(plan.primary?.provider, "provider-a");
  assert.equal(plan.critic?.provider, "provider-b");
});

test("critical plan is PARTIAL when no independent provider exists", () => {
  const plan = buildAstraModelMaxPlan(
    [
      model("one", "provider-a", { quality: 95 }),
      model("two", "provider-a", { quality: 90 }),
    ],
    "critical",
  );
  assert.equal(plan.status, "PARTIAL");
});

test("explicit request fails closed for undiscovered or unauthorized models", () => {
  const catalog = [model("allowed", "provider-a")];
  assert.throws(() => assertRequestedModelAuthorized("not-discovered", catalog));
  assert.throws(() =>
    assertRequestedModelAuthorized(
      "private",
      [model("private", "provider-x", { authorized: false })],
    ),
  );
});
