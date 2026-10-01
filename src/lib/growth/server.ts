import { discoverLaunchpadStaticAudit, recentDiscoverCandidates } from "@/lib/editorial/discover-launchpad";
import { readLedgerDurable } from "@/lib/editorial/ledger-store";
import { manualEditorialArticles } from "@/lib/editorial/manual-articles";
import { nationalBreakoutScorecard } from "@/lib/growth/national-breakout";
import { growthWindowSnapshot } from "@/lib/store";

export async function buildNationalBreakout(windowHours = 24) {
  const growth = await growthWindowSnapshot(windowHours);
  let discoverReady = 0;
  let discoverCandidates = 0;

  try {
    const durable = await readLedgerDurable();
    const manual = manualEditorialArticles();
    const byId = new Map([...manual, ...durable].map((article) => [article.id, article]));
    const candidates = recentDiscoverCandidates([...byId.values()], new Date(), 48).slice(0, 12);
    discoverCandidates = candidates.length;
    discoverReady = candidates.filter((article) => discoverLaunchpadStaticAudit(article).hardPass).length;
  } catch {
    discoverReady = 0;
    discoverCandidates = 0;
  }

  return nationalBreakoutScorecard({
    windowHours,
    ...growth,
    discoverReady,
    discoverCandidates,
  });
}
