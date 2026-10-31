import { runAutomaticPublishing, automaticPublicationsForDay } from "../src/lib/editorial/auto-reporter.server.ts";
import { readLedgerDurable } from "../src/lib/editorial/ledger-store.ts";
import { parisDate } from "../src/lib/editorial/time.ts";

// Vercel Hobby functions have a bounded lifetime: the publisher must refuse
// false-positive success when the durable store or model is unavailable.
export const maxDuration = 300;

function reply(body: Record<string, unknown>, status: number) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function GET(request: Request) {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) {
    return reply({ ok: false, error: "cron_secret_not_configured" }, 503);
  }
  if ((request.headers.get("authorization") || "") !== `Bearer ${secret}`) {
    return reply({ ok: false, error: "unauthorized" }, 401);
  }

  // PGlite and /tmp are not durable on a serverless platform.
  // A local Railway model URL cannot be a dependency of the replacement.
  const missing = [
    ...(!process.env.DATABASE_URL?.trim() ? ["DATABASE_URL"] : []),
    ...(!process.env.ASTRA_LOCAL_CHAT_BASE?.trim() ? ["ASTRA_LOCAL_CHAT_BASE"] : []),
  ];
  if (missing.length) {
    return reply({ ok: false, error: "publication_dependencies_missing", missing }, 503);
  }

  try {
    const now = new Date();
    const report = await runAutomaticPublishing(now, { trigger: "cron-api" });
    // Independent readback is the only evidence of publication persistence.
    const stored = await readLedgerDurable();
    const date = parisDate(now);
    const verified = automaticPublicationsForDay(stored, date);
    const readbackPass = report.newlyPublished.every(({ slot, slug }) =>
      verified.some((article) => article.slot === slot && article.slug === slug),
    );
    const hasPublication = verified.length > 0;
    const ok = readbackPass && hasPublication;

    return reply({
      ok,
      parisDate: date,
      generated: report.newlyPublished,
      rejected: report.rejected,
      eligibleSlots: report.eligibleSlots,
      automaticCountToday: verified.length,
      missingSlots: (["morning", "noon", "evening"] as const)
        .filter((slot) => !verified.some((article) => article.slot === slot)),
      durableReadback: readbackPass,
      status: verified.length === 3 ? "PASS_THREE_AUTOMATED_ARTICLES"
        : "DEGRADED_AUTOMATED_ARTICLE_QUOTA",
      articles: verified.map((article) => ({
        slug: article.slug, slot: article.slot, publishedAt: article.publishedAt,
      })),
    }, ok ? 200 : 503);
  } catch (error) {
    console.error("ASTRA_VERCEL_EDITORIAL_FAIL", error);
    return reply({ ok: false, error: "editorial_execution_failed" }, 500);
  }
}
