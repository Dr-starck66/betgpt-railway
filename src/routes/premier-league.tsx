import { createFileRoute } from "@tanstack/react-router";
import { CupPage } from "@/components/cup-page";
import { getLeagueDesk } from "@/lib/desk.functions";
import { leagueHead } from "@/lib/programmatic";

export const Route = createFileRoute("/premier-league")({
  loader: () => getLeagueDesk({ data: { league: "PL" } }),
  head: () => leagueHead("/premier-league", "Premier League"),
  component: () => <CupPage league="PL" title="Premier League" data={Route.useLoaderData()} />,
});
