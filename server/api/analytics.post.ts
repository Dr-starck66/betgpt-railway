import { defineEventHandler, readBody, setHeader, createError } from "h3";
import { analyticsIngestSchema } from "../../src/lib/schemas";
import { recordAnalytics } from "../../src/lib/store";

export default defineEventHandler(async (event) => {
  setHeader(event, "cache-control", "no-store");
  let raw: unknown;
  try {
    raw = await readBody(event);
  } catch {
    throw createError({ statusCode: 400, statusMessage: "invalid" });
  }
  const parsed = analyticsIngestSchema.safeParse(raw);
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: "invalid" });
  await recordAnalytics(parsed.data.e, parsed.data.p, parsed.data.route);
  return { ok: true };
});
