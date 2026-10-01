import { ENGINE_VERSION } from "../../src/engine/data";
import { defineEventHandler, setHeader } from "h3";

export default defineEventHandler((event) => {
  setHeader(event, "content-type", "application/json; charset=utf-8");
  setHeader(event, "cache-control", "no-store");
  return { ok: true, service: "betgpt", engineVersion: ENGINE_VERSION };
});
