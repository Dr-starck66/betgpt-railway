import { reliabilityConfig } from "../../src/lib/reliability/astra-reliability";
import { defineEventHandler } from "h3";

export default defineEventHandler(() => ({
  ok: true,
  status: "ok",
  service: "betgpt",
  runtime: "server",
  timestamp: new Date().toISOString(),
  reliability: reliabilityConfig(),
}));
