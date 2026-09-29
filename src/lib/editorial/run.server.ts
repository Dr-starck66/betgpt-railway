import { ensureLive } from "@/engine/live";
import type { MatchInput } from "@/engine/types";
import { buildEdition } from "@/lib/editorial/engine";
import { collectFootballNewsSignals } from "@/lib/editorial/news-scout.server";
import { readLedgerDurable, writeLedgerDurable } from "@/lib/editorial/ledger-store";
import { isPublicArticle } from "@/lib/editorial/types";

export async function editionFromDesk(now = new Date()) {
  const live = await ensureLive().catch(() => null);
  const matches = (live?.matches ?? []) as MatchInput[];
  const frozen = await readLedgerDurable();
  const signals = await collectFootballNewsSignals(now).catch(() => []);
  const edition = buildEdition({ now, matches, frozen, signals });
  const durable = await writeLedgerDurable(edition.articles.filter(isPublicArticle));
  return { edition, durable };
}
