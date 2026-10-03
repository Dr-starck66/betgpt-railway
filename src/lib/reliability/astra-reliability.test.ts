import assert from "node:assert/strict";
import test from "node:test";
import { reliabilityConfig } from "./astra-reliability.ts";

test("ASTRA reliability stays fail-closed for unconfigured optional services", () => {
  const snapshot = reliabilityConfig({});
  assert.equal(snapshot.components.gatus.status, "UNCONFIGURED");
  assert.equal(snapshot.components.litellm.status, "UNCONFIGURED");
  assert.equal(snapshot.components.trigger.status, "UNCONFIGURED");
  assert.equal(snapshot.components.langfuse.status, "UNCONFIGURED");
  assert.equal(snapshot.status, "UNVERIFIED");
});

test("ASTRA reliability reports configured components without inventing runtime proof", () => {
  const snapshot = reliabilityConfig({
    ASTRA_GATUS_URL: "https://gatus.invalid",
    ASTRA_LLM_GATEWAY_BASE: "https://litellm.invalid",
    TRIGGER_SECRET_KEY: "secret",
    LANGFUSE_PUBLIC_KEY: "public",
    LANGFUSE_SECRET_KEY: "secret",
    LANGFUSE_BASE_URL: "https://langfuse.invalid",
    OTEL_EXPORTER_OTLP_ENDPOINT: "https://otel.invalid",
  });
  assert.equal(snapshot.components.gatus.status, "CONFIGURED");
  assert.equal(snapshot.components.litellm.status, "CONFIGURED");
  assert.equal(snapshot.components.railwayTracing.status, "CONFIGURED");
  assert.equal(snapshot.status, "PARTIAL");
});
