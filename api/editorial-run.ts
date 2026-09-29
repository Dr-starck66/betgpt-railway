import { editionFromDesk } from "../src/lib/editorial/run.server.ts";

export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization") ?? "";
  const userAgent = request.headers.get("user-agent") ?? "";

  if (secret) {
    if (authorization !== `Bearer ${secret}`) {
      return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  } else if (!/vercel-cron\/1\.0/i.test(userAgent)) {
    return Response.json({ ok: false, error: "cron-only" }, { status: 403 });
  }

  const { edition, durable } = await editionFromDesk(new Date());
  return Response.json({
    ok: true,
    parisDate: edition.parisDate,
    durable,
    targetPerDay: 3,
    plannedCount: edition.plannedCount,
    targetStatus: edition.targetStatus,
    published: edition.articles.filter((article) => article.status === "PUBLISHED" || article.status === "UPDATED").length,
    slots: edition.slots.map((slot) => ({
      id: slot.id,
      time: slot.time,
      status: slot.article?.status ?? "WAITING_OR_REJECTED",
      title: slot.article?.h1 ?? null,
    })),
  });
}
