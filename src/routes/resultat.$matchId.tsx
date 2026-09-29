import { createFileRoute, redirect } from "@tanstack/react-router";
import { getMatchDesk } from "@/lib/desk.functions";

export const Route = createFileRoute("/resultat/$matchId")({
  loader: async ({ params }) => {
    const data = await getMatchDesk({ data: { id: params.matchId } });
    throw redirect({
      to: "/match/$matchId",
      params: { matchId: data?.match.slug ?? params.matchId },
      statusCode: 301,
      replace: true,
    });
  },
  head: () => ({
    meta: [{ name: "robots", content: "noindex, follow" }],
  }),
  component: () => null,
});
