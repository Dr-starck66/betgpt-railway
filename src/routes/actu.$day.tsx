import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ActuFeed } from "@/components/actu-feed";
import { getPublicDesk } from "@/lib/desk.functions";
import { BRAND_OG, imageHeadTags } from "@/lib/image-seo";
import { dayKey, dayLabel, editionAnswer, editionTitle } from "@/lib/news";
import { SITE_URL } from "@/lib/programmatic";

export const Route = createFileRoute("/actu/$day")({
  loader: async ({ params }) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(params.day)) throw notFound();
    const data = await getPublicDesk();
    const matches = data.matches.filter((m) => m.kickoff.slice(0, 10) === params.day);
    return { data, matches, day: params.day };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const preds = new Map(loaderData.data.predictions.map((p) => [p.matchId, p]));
    const title = `${editionTitle(loaderData.day)} | BetGPT`;
    const desc = editionAnswer(loaderData.matches, preds);
    const url = `${SITE_URL}/actu/${loaderData.day}`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1" },
        { property: "og:type", content: "article" },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:url", content: url },
        ...imageHeadTags(BRAND_OG),
        { property: "article:published_time", content: `${loaderData.day}T06:00:00+02:00` },
        { property: "article:modified_time", content: new Date().toISOString() },
        { property: "article:section", content: "Football" },
        { property: "article:publisher", content: SITE_URL },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  notFoundComponent: () => <p className="text-muted">Édition introuvable.</p>,
  component: EditionPage,
});

function EditionPage() {
  const { matches, day, data } = Route.useLoaderData();
  return (
    <div className="space-y-4">
      <ActuFeed
        matches={matches}
        predictions={data.predictions}
        day={day}
        url={`${SITE_URL}/actu/${day}`}
        kicker={`betgpt.live · ${day === dayKey() ? "édition du jour" : dayLabel(day)}`}
      />
      <p className="text-sm text-mist">
        <Link to="/actu" className="hover:text-sage">
          Toutes les actus
        </Link>
      </p>
    </div>
  );
}
