import { runAutomaticPublishing } from "../../src/lib/editorial/auto-reporter.server";

/**
 * Same Railway web process, no additional service or paid cron provider.
 * The first tick catches any slot missed while the service was being deployed.
 * One replica is configured for this service; the reporter is single-flight and
 * public article IDs are deterministic even if Nitro starts the plugin twice.
 */
export default function editorialAutopublishPlugin(): void {
  if (process.env.NODE_ENV !== "production") return;
  if (!process.env.BETGPT_EDITORIAL_CRON_TOKEN?.trim()) {
    console.warn("ASTRA_EDITORIAL_SCHEDULER_DISABLED missing BETGPT_EDITORIAL_CRON_TOKEN");
    return;
  }
  const tick = () => {
    void runAutomaticPublishing().then((proof) => {
      console.info("ASTRA_EDITORIAL_SCHEDULER_PROOF", JSON.stringify(proof));
    }).catch((error: unknown) => {
      console.error("ASTRA_EDITORIAL_SCHEDULER_ERROR", String(error));
    });
  };
  setTimeout(tick, 30_000).unref();
  setInterval(tick, 15 * 60_000).unref();
  console.info("ASTRA_EDITORIAL_SCHEDULER_ENABLED timezone=Europe/Paris slots=08:00,13:00,19:00 interval=15m");
}
