import { createFileRoute } from "@tanstack/react-router";
import { CupPage } from "@/components/cup-page";
import { getLeagueDesk } from "@/lib/desk.functions";
import { leagueHead } from "@/lib/programmatic";

export const Route = createFileRoute("/serie-a")({
  loader: () => getLeagueDesk({ data: { league: "SA" } }),
  head: () => leagueHead("/serie-a", "Serie A"),
  component: () => <CupPage league="SA" title="Serie A" data={Route.useLoaderData()} />,
});
