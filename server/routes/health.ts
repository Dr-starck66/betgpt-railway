import { ENGINE_VERSION } from "../../src/engine/data";
import { defineEventHandler, setHeader } from "h3";

export default defineEventHandler((event) => {
  setHeader(event, "content-type", "application/json; charset=utf-8");
  setHeader(event, "cache-control", "no-store");
  return { ok: true, service: "betgpt", engineVersion: ENGINE_VERSION, chatProvider: process.env.ASTRA_ROUTER_BASE && process.env.ASTRA_ROUTER_TOKEN ? "astra-super-router" : process.env.XAI_API_KEY ? "xai" : "local-fallback" };
});
