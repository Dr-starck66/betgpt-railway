import { defineEventHandler, setHeader } from "h3";
import { buildSearchTruth } from "../../src/lib/search/server";

export default defineEventHandler(async (event) => {
  setHeader(event, "cache-control", "no-store, no-cache, must-revalidate, max-age=0");
  return buildSearchTruth(24);
});
