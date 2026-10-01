import { SEARCH_TRUTH_AVAILABILITY } from "@/lib/search/search-truth";
import { searchTruthSnapshot } from "@/lib/store";

export async function buildSearchTruth(windowHours = 24) {
  const snapshot = await searchTruthSnapshot(windowHours);
  return {
    schema: "astra-search-truth/v1",
    status: "PASS",
    windowHours,
    availability: SEARCH_TRUTH_AVAILABILITY,
    measured: {
      organicLandings: snapshot.current,
      previousOrganicLandings: snapshot.previous,
      organicGrowth: snapshot.growth,
      bySource: snapshot.bySource,
      topLandingPages: snapshot.topRoutes,
    },
    unavailable: {
      queries: "Google Search Console not connected for betgpt.live",
      serpImpressions: "Google Search Console not connected for betgpt.live",
      serpCtr: "Google Search Console not connected for betgpt.live",
      averagePosition: "Google Search Console not connected for betgpt.live",
    },
  };
}
