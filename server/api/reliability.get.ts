import { defineEventHandler, setHeader } from "h3";
import { reliabilityConfig } from "../../src/lib/reliability/astra-reliability";

export default defineEventHandler((event) => {
  setHeader(event, "cache-control", "no-store");
  return reliabilityConfig();
});
