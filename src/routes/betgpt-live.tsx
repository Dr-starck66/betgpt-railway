import { createFileRoute } from "@tanstack/react-router";
import { GeoArticle } from "@/components/geo-article";
import { geoCanonical, geoDoc } from "@/lib/geo/entity";

const doc = geoDoc("/betgpt-live")!;

export const Route = createFileRoute("/betgpt-live")({
  head: () => ({
    meta: [
      { title: doc.title },
      { name: "description", content: doc.description },
      { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1" },
      { property: "og:site_name", content: "BetGPT Live" },
      { property: "og:url", content: geoCanonical(doc.path) },
    ],
    links: [{ rel: "canonical", href: geoCanonical(doc.path) }],
  }),
  component: () => <GeoArticle doc={doc} />,
});
