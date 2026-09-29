import type { MatchInput } from "@/engine/types";
import { competitionByLeague } from "@/lib/serp/leagues";
import { answerFirst, factRows, snippetQuestions } from "@/lib/serp/answer";
import { scoreFreshness, strictStatus } from "@/lib/serp/status";
import { nocookieEmbed, videoRelevance, type CuratedVideo } from "@/lib/serp/video";

export function MatchAnswer({
  match,
  liveAsOf,
  video,
}: {
  match: MatchInput;
  liveAsOf?: string | null;
  video?: CuratedVideo | null;
}) {
  const status = strictStatus(match);
  const fresh = scoreFreshness(liveAsOf);
  const stale = (status === "LIVE" || status === "HALFTIME") && fresh.stale;
  const section = status === "FINISHED" || status === "CANCELLED" ? { href: "/resultats-football", name: "Résultats football" } : { href: "/scores-en-direct", name: "Scores en direct" };
  const comp = competitionByLeague(match.league);
  const compHref = comp ? (status === "FINISHED" ? comp.resultsPath : comp.scoresPath) : section.href;
  const compName = comp?.title ?? match.competition;
  const rows = factRows(match, { stale });
  const questions = snippetQuestions(match, { stale });
  const play = video && videoRelevance(video, match).show ? video : null;

  return (
    <div className="mt-4 space-y-4">
      <p className="seo-answer text-base leading-relaxed text-paper">{answerFirst(match, { stale })}</p>
      {(status === "LIVE" || status === "HALFTIME") && fresh.known ? (
        <p className="text-xs text-muted">
          Dernière collecte des scores : il y a {fresh.ageSec}s{stale ? ". Ce score n’est pas un direct confirmé à la seconde." : "."}
        </p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[18rem] text-left text-sm">
          <caption className="sr-only">
            Faits du match {match.home.name} {match.away.name}
          </caption>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-line">
                <th scope="row" className="py-2 pr-4 font-medium text-muted">
                  {row.label}
                </th>
                <td className="py-2 text-paper">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <nav aria-label="Fil d’Ariane" className="text-xs text-mist">
        <a href="/" className="hover:text-sage">
          Accueil
        </a>
        {" → "}
        <a href={section.href} className="hover:text-sage">
          {section.name}
        </a>
        {" → "}
        <a href={compHref} className="hover:text-sage">
          {compName}
        </a>
        {" → "}
        <span className="text-paper">
          {match.home.name} – {match.away.name}
        </span>
      </nav>
      {questions.length ? (
        <div className="space-y-3">
          {questions.map((item) => (
            <section key={item.q}>
              <h2 className="text-base font-semibold text-paper">{item.q}</h2>
              <p className="mt-1 text-sm leading-relaxed text-mist">{item.a}</p>
            </section>
          ))}
        </div>
      ) : null}
      {play ? (
        <section id="video" className="space-y-2">
          <h2 className="text-base font-semibold text-paper">{play.title}</h2>
          <p className="text-xs text-muted">Source : {play.channelName}. Cette vidéo n’est pas produite par BetGPT.</p>
          <div className="relative aspect-video overflow-hidden rounded-lg bg-ink">
            <iframe
              className="absolute inset-0 h-full w-full"
              src={nocookieEmbed(play.videoId)}
              title={play.title}
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              allow="encrypted-media; picture-in-picture"
              allowFullScreen
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}
