import { useState } from "react";
import { nocookieEmbed, videoRelevance, youtubeIdFromUrl, youtubeMatchSearchUrl, type CuratedVideo } from "@/lib/serp/video";

type MatchVideoRef = {
  home: { name: string };
  away: { name: string };
  kickoff: string;
  competition: string;
  status?: string;
};

/**
 * Permanent interface on every fixture, irrespective of date or league.
 * Video discovery is NOT faked: no iframe until a curated video or a visitor's
 * explicit URL is available. The visitor-supplied video remains unverified.
 */
export function MatchYouTubePanel({ match, video }: { match: MatchVideoRef; video?: CuratedVideo | null }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [manualId, setManualId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const verified = video && videoRelevance(video, match).show ? video : null;
  const activeId = manualId ?? verified?.videoId ?? null;
  const chosenByVisitor = Boolean(manualId);

  return (
    <section className="space-y-3 rounded-xl border border-line p-4" aria-label={`Vidéos YouTube : ${match.home.name} contre ${match.away.name}`}>
      <h3 className="text-base font-semibold text-paper">Vidéos YouTube du match</h3>
      <p className="text-xs leading-relaxed text-mist">
        Match : {match.home.name} – {match.away.name} · {match.competition}. Lecteur chargé uniquement au clic, sans vidéo ni score inventés.
      </p>
      {verified && !manualId ? (
        <p className="text-xs leading-relaxed text-muted">
          Vidéo identifiée : {verified.title} · {verified.channelName}. Contenu externe indépendant de BetGPT.
        </p>
      ) : null}
      {activeId && open ? (
        <div className="relative aspect-video w-full max-w-3xl overflow-hidden rounded-lg bg-ink">
          <iframe
            className="absolute inset-0 h-full w-full"
            src={nocookieEmbed(activeId)}
            title={chosenByVisitor ? "Vidéo YouTube saisie par le visiteur (non vérifiée)" : verified?.title ?? "Vidéo YouTube"}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : activeId ? (
        <button type="button" onClick={() => setOpen(true)} className="chip-pill font-semibold hover:border-sage/30 hover:text-link">
          Charger la vidéo YouTube
        </button>
      ) : (
        <p className="text-xs text-muted">Aucune vidéo vérifiée enregistrée pour ce match. Le lecteur reste disponible avec une URL YouTube.</p>
      )}
      {chosenByVisitor ? (
        <p className="text-xs text-muted">Vidéo saisie par un visiteur : correspondance avec le match non vérifiée par BetGPT.</p>
      ) : null}
      <a
        href={youtubeMatchSearchUrl(match)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block text-sm font-semibold text-link underline decoration-link/40 underline-offset-2 hover:decoration-link"
      >
        Rechercher des vidéos de ce match sur YouTube
      </a>
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const id = youtubeIdFromUrl(url);
          if (!id) {
            setError("Lien YouTube invalide : utilisez une URL https://youtube.com/watch ou https://youtu.be/…");
            return;
          }
          setManualId(id);
          setOpen(true);
          setError("");
        }}
      >
        <label htmlFor={`youtube-url-${match.kickoff.replace(/[^A-Za-z0-9]/g, "")}-${match.home.name.replace(/[^A-Za-z0-9]/g, "")}-${match.away.name.replace(/[^A-Za-z0-9]/g, "")}`} className="sr-only">
          Coller une URL YouTube pour {match.home.name} – {match.away.name}
        </label>
        <input
          id={`youtube-url-${match.kickoff.replace(/[^A-Za-z0-9]/g, "")}-${match.home.name.replace(/[^A-Za-z0-9]/g, "")}-${match.away.name.replace(/[^A-Za-z0-9]/g, "")}`}
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="Coller une URL YouTube du match"
          type="url"
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-paper"
        />
        <button type="submit" className="chip-pill font-semibold hover:border-sage/30 hover:text-link">
          Ouvrir dans le lecteur
        </button>
      </form>
      {error ? <p role="alert" className="text-xs text-muted">{error}</p> : null}
    </section>
  );
}
