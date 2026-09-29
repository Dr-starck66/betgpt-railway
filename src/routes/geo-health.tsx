import { createFileRoute } from "@tanstack/react-router";
import { GeoHealthPanel } from "@/components/geo-health-panel";
import { SportsSerpPanel } from "@/components/sports-serp-panel";
import { SITE_URL } from "@/lib/programmatic";

export const Route = createFileRoute("/geo-health")({
  head: () => ({
    meta: [
      { title: "Santé SEO / GEO | BetGPT" },
      { name: "description", content: "Diagnostic interne de l’indexation BetGPT. Cette page n’est pas destinée aux résultats de recherche." },
      { name: "robots", content: "noindex, follow" },
      { name: "googlebot", content: "noindex, follow" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/geo-health` }],
  }),
  component: () => (
    <>
      <GeoHealthPanel />
      <SportsSerpPanel />
    </>
  ),
});
