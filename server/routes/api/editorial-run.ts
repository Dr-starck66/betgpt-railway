import { defineEventHandler, getHeader, getQuery, setResponseStatus } from "h3";
import { editionFromDesk } from "../../../src/lib/editorial/run.server";
import { hasAutomaticProof, runAutomaticPublishing } from "../../../src/lib/editorial/auto-reporter.server";
import { readLedgerDurable } from "../../../src/lib/editorial/ledger-store";
import { parisDate } from "../../../src/lib/editorial/time";

export default defineEventHandler(async (event) => {
  const secret = (process.env.BETGPT_EDITORIAL_CRON_TOKEN ?? "").trim();
  const auth = getHeader(event, "authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    setResponseStatus(event, 401);
    return { ok: false, error: "unauthorized" };
  }
  try {
    const now = new Date();
    const catchup = getQuery(event).catchup === "1";
    const autoReport = await runAutomaticPublishing(now, { trigger: catchup ? "operator-catchup" : "cron-api", catchup });
    const { edition, durable, liveDataStatus } = await editionFromDesk(now);
    const stored = await readLedgerDurable();
    const autoToday = stored.filter((article) => article.id === `ed-${edition.parisDate}-${article.slot}` &&
      article.parisDate === edition.parisDate && article.publishedAt &&
      parisDate(new Date(article.publishedAt)) === edition.parisDate &&
      hasAutomaticProof(article));
    const missingAutomaticSlots = (["morning", "noon", "evening"] as const)
      .filter((slot) => !autoToday.some((article) => article.slot === slot));
    const published = edition.articles.filter(
      (article) => article.status === "PUBLISHED" || article.status === "UPDATED",
    );
    return {
      ok: true,
      parisDate: edition.parisDate,
      durable,
      liveDataStatus,
      targetPerDay: 3,
      automaticCountToday: autoToday.length,
      missingAutomaticSlots,
      automaticPublicationStatus: missingAutomaticSlots.length ? "DEGRADED_AUTOMATED_ARTICLE_QUOTA" : "PASS_THREE_AUTOMATED_ARTICLES",
      autoReporter: autoReport,
      plannedCount: edition.plannedCount,
      targetStatus: edition.targetStatus,
      published: published.length,
      articles: published.map((article) => ({
        id: article.id,
        slug: article.slug,
        title: article.h1,
        status: article.status,
        publishedAt: article.publishedAt,
      })),
      payload: published,
    };
  } catch (error) {
    setResponseStatus(event, 500);
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("[editorial-run]", err.stack ?? err.message);
    return {
      ok: false,
      error: err.name,
      message: err.message,
      stack: (err.stack ?? "").split("\n").slice(0, 8),
    };
  }
});
