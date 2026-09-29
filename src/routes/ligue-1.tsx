import { createFileRoute } from "@tanstack/react-router";
import { CupPage } from "@/components/cup-page";
import { getLeagueDesk } from "@/lib/desk.functions";
import { leagueHead } from "@/lib/programmatic";

export const Route = createFileRoute("/ligue-1")({
  loader: () => getLeagueDesk({ data: { league: "L1" } }),
  head: () => leagueHead("/ligue-1", "Ligue 1"),
  component: () => <CupPage league="L1" title="Ligue 1" data={Route.useLoaderData()} />,
});
