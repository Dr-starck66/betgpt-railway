import { createFileRoute } from "@tanstack/react-router";
import { CupPage } from "@/components/cup-page";
import { getLeagueDesk } from "@/lib/desk.functions";
import { leagueHead } from "@/lib/programmatic";

export const Route = createFileRoute("/bundesliga")({
  loader: () => getLeagueDesk({ data: { league: "BL" } }),
  head: () => leagueHead("/bundesliga", "Bundesliga"),
  component: () => <CupPage league="BL" title="Bundesliga" data={Route.useLoaderData()} />,
});
