import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { MatchInput } from "@/engine/types";
import { isCuratedVideo, videoRelevance, type CuratedVideo } from "@/lib/serp/video";

const FILE = join(process.cwd(), "data", "match-videos.json");

export function loadCuratedVideos(): CuratedVideo[] {
  try {
    const raw = JSON.parse(readFileSync(FILE, "utf8")) as { videos?: unknown[] } | unknown[];
    const list = Array.isArray(raw) ? raw : raw.videos;
    if (!Array.isArray(list)) return [];
    return list.filter(isCuratedVideo);
  } catch {
    return [];
  }
}

export function pickMatchVideo(match: Pick<MatchInput, "home" | "away" | "kickoff" | "competition" | "status">): CuratedVideo | null {
  let best: { video: CuratedVideo; score: number } | null = null;
  for (const video of loadCuratedVideos()) {
    const rel = videoRelevance(video, match);
    if (!rel.show) continue;
    if (!best || rel.score > best.score) best = { video, score: rel.score };
  }
  return best?.video ?? null;
}

/** Optional later. Pages must not call YouTube during render. */
export function youtubeApiConfigured(): boolean {
  return Boolean(process.env.YOUTUBE_API_KEY);
}
