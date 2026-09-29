export type VideoKind = "highlights" | "preview" | "press" | "lineup" | "goals" | "reaction" | "analysis";

export type VideoClip = { name: string; startOffset: number; endOffset?: number };

/** A video BetGPT may show only when this record was curated or matched, never invented. */
export type CuratedVideo = {
  videoId: string;
  title: string;
  description: string;
  channelName: string;
  publishedAt: string;
  thumbnailUrl?: string;
  durationIso?: string;
  home: string;
  away: string;
  kickoffDay: string;
  competition?: string;
  kind: VideoKind;
  official: boolean;
  language?: string;
  livestream?: boolean;
  clips?: VideoClip[];
};

const ID_RE = /^[a-zA-Z0-9_-]{6,20}$/;
const KINDS = new Set<VideoKind>(["highlights", "preview", "press", "lineup", "goals", "reaction", "analysis"]);

export function foldName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

export function isCuratedVideo(value: unknown): value is CuratedVideo {
  if (!value || typeof value !== "object") return false;
  const v = value as CuratedVideo;
  return (
    typeof v.videoId === "string" &&
    ID_RE.test(v.videoId) &&
    typeof v.title === "string" &&
    v.title.trim().length > 3 &&
    typeof v.channelName === "string" &&
    v.channelName.trim().length > 1 &&
    typeof v.publishedAt === "string" &&
    Number.isFinite(Date.parse(v.publishedAt)) &&
    typeof v.home === "string" &&
    typeof v.away === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(v.kickoffDay) &&
    KINDS.has(v.kind)
  );
}

export function videoRelevance(
  video: CuratedVideo,
  match: { home: { name: string }; away: { name: string }; kickoff: string; competition?: string; status?: string },
): { score: number; show: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const day = String(match.kickoff ?? "").slice(0, 10);
  if (!day || video.kickoffDay !== day) return { score: 0, show: false, reasons: ["date différente"] };
  const vh = foldName(video.home);
  const va = foldName(video.away);
  const mh = foldName(match.home.name);
  const ma = foldName(match.away.name);
  if (!((vh === mh && va === ma) || (vh === ma && va === mh))) {
    return { score: 0, show: false, reasons: ["équipes différentes"] };
  }
  let score = 70;
  reasons.push("équipes et date");
  if (video.official) {
    score += 15;
    reasons.push("source déclarée officielle");
  }
  if (video.competition && match.competition && foldName(video.competition) === foldName(match.competition)) score += 5;
  if ((video.language ?? "fr").toLowerCase().startsWith("fr")) score += 5;
  const finished = match.status === "finished";
  const recap = video.kind === "highlights" || video.kind === "goals" || video.kind === "reaction";
  if (!finished && recap) return { score: 0, show: false, reasons: ["résumé d’un match non terminé"] };
  if (finished && (video.kind === "preview" || video.kind === "lineup")) score -= 30;
  const show = score >= 70 && ID_RE.test(video.videoId);
  return { score, show, reasons };
}

export function youtubeThumb(video: CuratedVideo): string | null {
  if (video.thumbnailUrl && /^https:\/\/(i\.ytimg\.com|img\.youtube\.com)\//.test(video.thumbnailUrl)) return video.thumbnailUrl;
  if (ID_RE.test(video.videoId)) return `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`;
  return null;
}

export function nocookieEmbed(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}`;
}

export function videoObjectLd(video: CuratedVideo, pageUrl: string): Record<string, unknown> | null {
  const thumb = youtubeThumb(video);
  if (!thumb) return null;
  const obj: Record<string, unknown> = {
    "@type": "VideoObject",
    name: video.title,
    description: video.description?.trim() || video.title,
    thumbnailUrl: [thumb],
    uploadDate: video.publishedAt,
    embedUrl: `https://www.youtube.com/embed/${video.videoId}`,
    contentUrl: `https://www.youtube.com/watch?v=${video.videoId}`,
    publisher: { "@type": "Organization", name: video.channelName },
    url: pageUrl,
  };
  if (video.durationIso && /^PT[0-9HMS]+$/.test(video.durationIso)) obj.duration = video.durationIso;
  const clips = (video.clips ?? []).filter((c) => c.name && Number.isFinite(c.startOffset) && c.startOffset >= 0);
  if (clips.length) {
    obj.hasPart = clips.map((c) => ({
      "@type": "Clip",
      name: c.name,
      startOffset: c.startOffset,
      ...(c.endOffset != null && c.endOffset > c.startOffset ? { endOffset: c.endOffset } : {}),
      url: `https://www.youtube.com/watch?v=${video.videoId}&t=${c.startOffset}`,
    }));
  }
  return obj;
}

/** Only a real embedded livestream may carry BroadcastEvent. Never a scoreboard. */
export function liveBroadcastLd(video: CuratedVideo): Record<string, unknown> | null {
  if (video.livestream !== true) return null;
  return {
    "@type": "BroadcastEvent",
    name: video.title,
    isLiveBroadcast: true,
    startDate: video.publishedAt,
    broadcastOfEvent: { "@type": "VideoObject", embedUrl: `https://www.youtube.com/embed/${video.videoId}` },
  };
}
