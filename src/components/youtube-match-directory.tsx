import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import type { LeagueId, MatchInput } from "@/engine/types";
import { ALL_LEAGUES, LEAGUE_LABEL } from "@/lib/labels";
import { getHomeSlice } from "@/lib/desk.functions";
import { MatchYouTubePanel } from "@/components/match-youtube-panel";
import type { CuratedVideo } from "@/lib/serp/video";

type LeagueChoice = LeagueId | "ALL";

/** Paginated on demand so editorial SSR/SEO and existing article URLs are unchanged. */
export function YouTubeMatchDirectory() {
  const getSlice = useServerFn(getHomeSlice);
  const [league, setLeague] = useState<LeagueChoice>("ALL");
  const [matches, setMatches] = useState<MatchInput[]>([]);
  const [videos, setVideos] = useState<Record<string, CuratedVideo | null>>({});
  const [total, setTotal] = useState(0);
  const [started, setStarted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const latestRequest = useRef(0);

  async function fetchMatches(nextLeague: LeagueChoice, reset: boolean) {
    const request = ++latestRequest.current;
    setBusy(true);
    setError("");
    try {
      const response = await getSlice({ data: { offset: reset ? 0 : matches.length, league: nextLeague } });
      if (request !== latestRequest.current) return;
      setMatches((before) => reset ? response.matches : [...before, ...response.matches]);
      setVideos((before) => reset ? response.videos : { ...before, ...response.videos });
      setTotal(response.total);
      setStarted(true);
    } catch {
      if (request === latestRequest.current) setError("Rencontres indisponibles : aucune vidéo ni rencontre ne sera inventée.");
    } finally {
      if (request === latestRequest.current) setBusy(false);
    }
  }

  return (
    <section className="surface-card space-y-4 p-5 sm:p-6" aria-labelledby="youtube-match-directory-title">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-link">BetGPT · vidéos des rencontres</p>
      <h2 id="youtube-match-directory-title" className="text-xl font-bold tracking-tight text-paper sm:text-2xl">
        Vidéos YouTube : tous les championnats couverts
      </h2>
      <p className="max-w-3xl text-sm leading-relaxed text-mist">
        Accès permanent aux vidéos et analyses des matchs du catalogue BetGPT, sans limite de date.
        Le lecteur s’ouvre au clic lorsqu’une vidéo associée est connue ou lorsqu’un lien YouTube est fourni.
        La recherche ouvre YouTube si aucun contenu n’a été vérifié.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="youtube-league-choice" className="text-sm font-medium text-paper">Championnat</label>
        <select
          id="youtube-league-choice"
          value={league}
          onChange={(event) => {
            const choice = event.target.value as LeagueChoice;
            setLeague(choice);
            setMatches([]);
            setVideos({});
            setTotal(0);
            setStarted(false);
            void fetchMatches(choice, true);
          }}
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-paper"
        >
          <option value="ALL">Toutes les compétitions</option>
          {ALL_LEAGUES.map((code) => <option key={code} value={code}>{LEAGUE_LABEL[code]}</option>)}
        </select>
        {!started && !busy ? (
          <button type="button" onClick={() => void fetchMatches(league, true)} className="chip-pill font-semibold hover:border-sage/30 hover:text-link">
            Afficher les matchs
          </button>
        ) : null}
        {busy ? <span role="status" className="text-xs text-muted">Chargement…</span> : null}
      </div>
      {error ? <p role="alert" className="text-sm text-muted">{error}</p> : null}
      {started && !matches.length && !busy ? (
        <p className="text-sm text-muted">Aucune rencontre disponible dans le catalogue actuel pour ce championnat.</p>
      ) : null}
      {matches.length ? (
        <div className="space-y-3">
          <p className="text-xs text-muted">{matches.length} rencontre(s) affichée(s) sur {total} actuellement disponibles dans le catalogue.</p>
          <ul className="space-y-3">
            {matches.map((match) => (
              <li key={match.id}>
                <details className="rounded-xl border border-line p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-paper">
                    {match.home.name} – {match.away.name} · {match.competition} · {match.kickoff.slice(0, 10)}
                  </summary>
                  <div className="mt-3">
                    <MatchYouTubePanel match={match} video={videos[match.id]} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
          {matches.length < total && !busy ? (
            <button type="button" onClick={() => void fetchMatches(league, false)} className="chip-pill font-semibold hover:border-sage/30 hover:text-link">
              Afficher d’autres matchs
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
