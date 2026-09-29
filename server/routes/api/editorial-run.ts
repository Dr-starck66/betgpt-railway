import { defineEventHandler, getHeader, setResponseStatus } from "h3";
import { editionFromDesk } from "../../../src/lib/editorial/run.server";

export default defineEventHandler(async (event) => {
  const secret = (process.env.BETGPT_EDITORIAL_CRON_TOKEN ?? "").trim();
  const auth = getHeader(event, "authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    setResponseStatus(event, 401);
    return { ok: false, error: "unauthorized" };
  }
  const { edition, durable } = await editionFromDesk(new Date());
  const published = edition.articles.filter(
    (article) => article.status === "PUBLISHED" || article.status === "UPDATED",
  );
  return {
    ok: true,
    parisDate: edition.parisDate,
    durable,
    targetPerDay: 3,
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
});
