import { manualEditorialArticles } from "../src/lib/editorial/manual-articles.ts";
import { parisDate } from "../src/lib/editorial/time.ts";
import { isPublicArticle } from "../src/lib/editorial/types.ts";

// Read-only: the external ASTRA agent commits articles to GitHub, and Vercel
// serves that immutable build. This endpoint does not generate, publish or
// claim durable database writes from a serverless filesystem.
export async function GET() {
  const day = parisDate(new Date());
  const published = manualEditorialArticles().filter(isPublicArticle);
  const today = published.filter((article) => article.parisDate === day);
  const bySlot = Object.fromEntries(
    (["morning", "noon", "evening"] as const).map((slot) => [
      slot,
      today.filter((article) => article.slot === slot).map((article) => ({
        slug: article.slug, status: article.status, publishedAt: article.publishedAt,
      })),
    ]),
  );
  return Response.json(
    {
      ok: true,
      mode: "ASTRA_AGENT_GITHUB_VERCEL",
      operation: "READ_ONLY",
      parisDate: day,
      publishedFromBuild: published.length,
      publishedTodayFromBuild: today.length,
      slots: bySlot,
      // The code/build view alone is not a public-URL or search-indexing proof.
      publicUrlProof: "UNVERIFIED",
      nativeQwenGeneration: false,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
