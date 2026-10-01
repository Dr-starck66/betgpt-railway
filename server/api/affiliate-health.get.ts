import { defineEventHandler, setHeader } from "h3";
import { hydrateAdmin } from "../../src/engine/admin";
import { affiliateConversionSnapshot } from "../../src/engine/affiliate-conversion";

export default defineEventHandler(async (event) => {
  setHeader(event, "cache-control", "no-store");
  await hydrateAdmin().catch(() => undefined);
  return affiliateConversionSnapshot();
});
