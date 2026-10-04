import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { MatchDetail } from "@/components/match-detail";
import { MatchHunter } from "@/components/match-hunter";
import { MatchLineups } from "@/components/match-lineups";
import { MatchMissing } from "@/components/match-missing";
import { getMatchDesk } from "@/lib/desk.functions";
import { matchHead, datesFromVersions, matchRouteId } from "@/lib/seo";
import { scoreFreshness, strictStatus } from "@/lib/serp/status";
import { track } from "@/lib/analytics";
import { useEffect } from "react";

export const Route = createFileRoute("/match/$matchId")({
  loader: async ({ params }) => {
    const requested = matchRouteId({ id: params.matchId });
    if (!requested) {
      throw redirect({
        to: "/scores-en-direct",
        statusCode: 301,
        replace: true,
      });
    }
    const data = await getMatchDesk({ data: { id: requested } });
    if (!data) throw notFound();
    const canonical = data.match.slug ?? data.match.id;
    if (canonical && canonical !== params.matchId) {
      throw redirect({
        to: "/match/$matchId",
        params: { matchId: canonical },
        statusCode: 301,
        replace: true,
      });
    }
    return data;
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Match | BetGPT" },
          { name: "robots", content: "noindex, follow" },
          { name: "description", content: "Dossier match BetGPT : scores, pronos et bilan vérifié." },
        ],
      };
    }
    const dates = datesFromVersions(loaderData.versions, loaderData.prediction.timestamp);
    const state = strictStatus(loaderData.match);
    const stale = (state === "LIVE" || state === "HALFTIME") && scoreFreshness(loaderData.liveAsOf).stale;
    return matchHead(loaderData.match, loaderData.prediction, {
      ...dates,
      scoreStale: stale,
      video: loaderData.video ?? null,
    });
  },
  component: MatchPage,
  notFoundComponent: MatchMissingPage,
});

function MatchMissingPage() {
  const params = Route.useParams();
  return <MatchMissing id={params.matchId} />;
}

function MatchPage() {
  const data = Route.useLoaderData();
  useEffect(() => {
    track("match_view", data.match.id);
  }, [data.match.id]);
  return (
    <div className="space-y-6">
      <MatchDetail
        match={data.match}
        prediction={data.prediction}
        sisters={data.sisters ?? []}
        ticket={data.ticket ?? null}
        versions={data.versions ?? []}
        liveAsOf={data.liveAsOf ?? null}
        video={data.video ?? null}
      />
      <MatchLineups
        matchId={data.match.slug ?? data.match.id}
        homeName={data.match.home.name}
        awayName={data.match.away.name}
      />
      <MatchHunter matchId={data.match.id} />
    </div>
  );
}