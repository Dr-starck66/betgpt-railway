import { defineEventHandler, setHeader } from "h3";
import { buildNationalBreakout } from "../../src/lib/growth/server";

export default defineEventHandler(async (event) => {
  setHeader(event, "cache-control", "no-store, no-cache, must-revalidate, max-age=0");
  const scorecard = await buildNationalBreakout(24);
  return {
    health: "PASS",
    generatedAt: new Date().toISOString(),
    ...scorecard,
  };
});
