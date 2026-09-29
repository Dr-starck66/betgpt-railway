import { createFileRoute, Link } from "@tanstack/react-router";
import { ActuFeed } from "@/components/actu-feed";
import { getPublicDesk } from "@/lib/desk.functions";
import { BRAND_OG, imageHeadTags } from "@/lib/image-seo";
import { dayKey, editionAnswer, editionTitle } from "@/lib/news";
import { SITE_URL } from "@/lib/programmatic";

export const Route = createFileRoute("/actu/")({
  loader: () => getPublicDesk(),
  head: ({ loaderData }) => {
    const today = dayKey();
    const preds = new Map((loaderData?.predictions ?? []).map((p) => [p.matchId, p]));
    const desc = loaderData ? editionAnswer(loaderData.matches, preds) : editionTitle(today);
    return {
      meta: [
        { title: `Résultats football aujourd'hui, pronostics et scores en direct | BetGPT` },
        { name: "description", content: desc },
        { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1" },
        { property: "og:type", content: "article" },
        { property: "og:title", content: `Résultats football aujourd'hui | BetGPT` },
        { property: "og:description", content: desc },
        { property: "og:url", content: `${SITE_URL}/actu` },
        ...imageHeadTags(BRAND_OG),
        { property: "article:published_time", content: `${today}T06:00:00+02:00` },
        { property: "article:modified_time", content: `${today}T18:00:00+02:00` },
        { property: "article:section", content: "Football" },
        { property: "article:publisher", content: SITE_URL },
      ],
      links: [
        { rel: "canonical", href: `${SITE_URL}/actu` },
        { rel: "alternate", type: "application/rss+xml", href: `${SITE_URL}/feed.xml` },
      ],
    };
  },
  component: ActuPage,
});

function ActuPage() {
  const data = Route.useLoaderData();
  const today = dayKey();
  return (
    <div className="space-y-4">
      <p className="text-sm text-mist">
        <Link to="/actu/$day" params={{ day: today }} className="text-sage hover:underline">
          Édition du {today}
        </Link>
        {" · "}
        <a href="/feed.xml">RSS</a>
      </p>
      <ActuFeed
        matches={data.matches}
        predictions={data.predictions}
        day={today}
        url={`${SITE_URL}/actu`}
        kicker="betgpt.live · Actu · Google News"
      />
    </div>
  );
}
