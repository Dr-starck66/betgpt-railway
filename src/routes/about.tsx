import { createFileRoute } from "@tanstack/react-router";
import { GeoArticle } from "@/components/geo-article";
import { geoCanonical, geoDoc } from "@/lib/geo/entity";

const doc = geoDoc("/about")!;

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: doc.title },
      { name: "description", content: doc.description },
      { name: "robots", content: "index, follow" },
    ],
    links: [{ rel: "canonical", href: geoCanonical(doc.path) }],
  }),
  component: () => <GeoArticle doc={doc} />,
});
