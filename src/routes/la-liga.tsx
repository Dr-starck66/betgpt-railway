import { createFileRoute } from "@tanstack/react-router";
import { CupPage } from "@/components/cup-page";
import { getLeagueDesk } from "@/lib/desk.functions";
import { leagueHead } from "@/lib/programmatic";

export const Route = createFileRoute("/la-liga")({
  loader: () => getLeagueDesk({ data: { league: "LL" } }),
  head: () => leagueHead("/la-liga", "La Liga"),
  component: () => <CupPage league="LL" title="La Liga" data={Route.useLoaderData()} />,
});
