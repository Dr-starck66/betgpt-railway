import { createFileRoute, Link } from "@tanstack/react-router";
import { TeamLine } from "@/components/crest";
import { CoconMesh } from "@/components/cocon-mesh";
import { LiveScore } from "@/components/live-score";
import { LiveSuperCard } from "@/components/live-super";
import { BookLinks } from "@/components/book-links";
import { getPublicDesk } from "@/lib/desk.functions";
import { COCON_MERES } from "@/lib/cocon";
import { SITE_URL } from "@/lib/programmatic";
import { useLiveRefresh } from "@/lib/live-refresh";

export const Route = createFileRoute("/pari-en-direct")({
  loader: () => getPublicDesk(),
  head: () => ({
    meta: [
      { title: "Pari en direct football : super pari live | BetGPT" },
      {
        name: "description",
        content:
          "Paris en direct : score live, super pari du moment, filet. Pour ceux qui jouent le match, pas la veille.",
      },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/pari-en-direct` }],
  }),
  component: LiveBets,
});

function LiveBets() {
  const data = Route.useLoaderData();
  const live = data.matches.filter((m) => m.status === "live");
  useLiveRefresh(live.length > 0);
  const byId = new Map(data.predictions.map((p) => [p.matchId, p]));
  return (
    <article className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Pari en direct</h1>
        <p className="seo-answer mt-2 max-w-3xl text-sm text-paper">
          {live.length
            ? `${live.length} matchs en cours. Super pari recalculé sur le score, la minute, les buteurs.`
            : "Pas de match en live. Reviens au coup d'envoi."}
        </p>
      </header>
      <CoconMesh
        crumbs={[
          { name: "BetGPT", href: "/" },
          { name: "Pari en direct", href: "/pari-en-direct" },
        ]}
        parent={{ href: "/pari-du-jour", anchor: "Pari du jour", rel: "parent" }}
        sisters={COCON_MERES.map((m) => ({ href: m.path, anchor: m.title, rel: "sister" as const }))}
        children={live.slice(0, 8).map((m) => ({
          href: `/match/${m.slug ?? m.id}`,
          anchor: `Super pari ${m.home.name} – ${m.away.name}`,
          rel: "child" as const,
        }))}
      />
      {live.length === 0 ? (
        <p className="text-mist">
          En attendant :{" "}
          <Link to="/pari-du-jour" className="text-sage">
            pari du jour
          </Link>
          .
        </p>
      ) : (
        <ul className="space-y-4">
          {live.map((m) => {
            const p = byId.get(m.id);
            return (
              <li key={m.id} className="space-y-3 rounded-xl border border-line bg-surface p-4">
                <div className="flex items-center justify-between gap-3">
                  <Link to="/match/$matchId" params={{ matchId: m.slug ?? m.id }} className="min-w-0 hover:text-sage">
                    <TeamLine home={m.home} away={m.away} size={32} names="full" competition={m.competition} />
                  </Link>
                  <LiveScore match={m} size="sm" />
                </div>
                {p?.liveSuper ? <LiveSuperCard bet={p.liveSuper} /> : <p className="text-sm text-mist">Lecture live en cours.</p>}
                {p ? <BookLinks links={p.bookLinks} matchId={m.id} /> : null}
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}
