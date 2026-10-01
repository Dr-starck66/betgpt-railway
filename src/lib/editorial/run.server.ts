import { ensureLive } from "@/engine/live";
import type { MatchInput } from "@/engine/types";
import { buildEdition } from "@/lib/editorial/engine";
import { collectFootballNewsSignals } from "@/lib/editorial/news-scout.server";
import { readLedgerDurable, writeLedgerDurable } from "@/lib/editorial/ledger-store";
import { isPublicArticle } from "@/lib/editorial/types";
import { manualEditorialArticles } from "@/lib/editorial/manual-articles";

export async function editionFromDesk(now = new Date()) {
  const live = await ensureLive().catch(() => null);
  const matches = (live?.matches ?? []) as MatchInput[];
  const durableFrozen = await readLedgerDurable();
  const seeded = manualEditorialArticles();
  const seededIds = new Set(seeded.map((article) => article.id));
  const frozen = [...seeded, ...durableFrozen.filter((article) => !seededIds.has(article.id))];
  const signals = await collectFootballNewsSignals(now).catch(() => []);
  const edition = buildEdition({ now, matches, frozen, signals });
  const durable = await writeLedgerDurable(edition.articles.filter(isPublicArticle));
  return { edition, durable };
}
