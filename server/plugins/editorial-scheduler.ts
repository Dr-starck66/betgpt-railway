import { definePlugin } from "nitro";
import { editionFromDesk } from "../../src/lib/editorial/run.server";

const INTERVAL_MS = 5 * 60 * 1000;

export default definePlugin(() => {
  if (process.env.BETGPT_EDITORIAL_SCHEDULER === "0") return;

  let running = false;

  async function run(reason: string) {
    if (running) return;
    running = true;
    try {
      const { edition, durable } = await editionFromDesk(new Date());
      const published = edition.articles.filter(
        (article) => article.status === "PUBLISHED" || article.status === "UPDATED",
      );
      console.log(
        "[editorial-scheduler]",
        JSON.stringify({
          reason,
          parisDate: edition.parisDate,
          durable,
          published: published.length,
          targetStatus: edition.targetStatus,
          slots: edition.slots.map((slot) => ({
            id: slot.id,
            time: slot.time,
            status: slot.article?.status ?? "WAITING_OR_REJECTED",
            slug: slot.article?.slug ?? null,
          })),
        }),
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error("[editorial-scheduler] FAILED", err.stack ?? err.message);
    } finally {
      running = false;
    }
  }

  const first = setTimeout(() => void run("startup"), 10_000);
  first.unref?.();

  const timer = setInterval(() => void run("interval"), INTERVAL_MS);
  timer.unref?.();
});
