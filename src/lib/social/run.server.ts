import type { EditorialArticle } from "@/lib/editorial/types";
import { buildXPublication, xIntentUrl } from "@/lib/social/content";
import { readSocialLedgerDurable, writeSocialLedgerDurable } from "@/lib/social/ledger-store";
import { publishToX, xProviderHealth } from "@/lib/social/provider.server";
import type { SocialPublication, SocialSyncResult } from "@/lib/social/types";

const DEFAULT_NEW_ARTICLE_WINDOW_MS = 2 * 60 * 60 * 1000;

function publicationIsNew(article: EditorialArticle, now: Date): boolean {
  if (article.status !== "PUBLISHED" || !article.publishedAt) return false;
  const published = Date.parse(article.publishedAt);
  if (!Number.isFinite(published)) return false;
  const age = now.getTime() - published;
  return age >= -60_000 && age <= DEFAULT_NEW_ARTICLE_WINDOW_MS;
}

function retryIsFresh(row: SocialPublication, now: Date): boolean {
  if (row.status !== "RETRY" || row.retryCount >= 3) return false;
  const scheduled = Date.parse(row.scheduledAt);
  if (!Number.isFinite(scheduled)) return false;
  return now.getTime() - scheduled <= 3 * 60 * 60 * 1000;
}

export async function syncPublishedArticlesToSocial(
  articles: EditorialArticle[],
  now = new Date(),
): Promise<SocialSyncResult> {
  const existing = await readSocialLedgerDurable();
  const byId = new Map(existing.map((row) => [row.id, row]));
  const created: SocialPublication[] = [];

  for (const article of articles) {
    if (!publicationIsNew(article, now)) continue;
    const draft = buildXPublication(article, now);
    if (byId.has(draft.id)) continue;
    byId.set(draft.id, draft);
    created.push(draft);
  }

  const provider = xProviderHealth();
  let publishAttempts = 0;

  if (provider.autoPublish) {
    for (const row of [...byId.values()]) {
      const shouldAttempt = created.some((item) => item.id === row.id) || retryIsFresh(row, now);
      if (!shouldAttempt || row.status === "PUBLISHED") continue;
      publishAttempts += 1;
      byId.set(row.id, await publishToX(row));
    }
  }

  const persisted = await writeSocialLedgerDurable([...byId.values()]);
  return { created, persisted, provider, publishAttempts };
}

export async function socialAdminSnapshot() {
  const rows = await readSocialLedgerDurable();
  const provider = xProviderHealth();
  const counts = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});
  return {
    provider,
    counts,
    rows: rows.map((row) => ({
      ...row,
      intentUrl: xIntentUrl(row),
    })),
  };
}
