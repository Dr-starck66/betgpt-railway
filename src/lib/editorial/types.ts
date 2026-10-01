import type { LeagueId } from "@/engine/types";

export type { LeagueId };

/** Confiance d'un fait. Ce n'est pas une probabilité d'apparition dans Google. */
export type SourceStatus = "OFFICIAL" | "HIGH_CONFIDENCE" | "CORROBORATED" | "UNCONFIRMED" | "UNKNOWN";

export type SlotId = "morning" | "noon" | "evening";

export type ArticleType = "slate" | "preview" | "brief" | "postmatch" | "news"; // slate kept only for backward compatibility; no new auto-slate is published

export type ArticleStatus = "PUBLISHED" | "SCHEDULED" | "UPDATED";

export type EditorialSource = {
  id: string;
  label: string;
  status: SourceStatus;
  note: string;
  url?: string;
};

export type NewsSourceTier = "OFFICIAL" | "TIER1" | "OTHER";

export type EditorialNewsSignal = {
  id: string;
  title: string;
  url: string;
  sourceName: string;
  sourceUrl?: string;
  publishedAt: string;
  description?: string;
  sourceTier: NewsSourceTier;
  entities: string[];
  language: "fr";
};

export type EditorialImage = {
  src: string;
  alt: string;
  width: number;
  height: number;
  credit: string;
};

export type EditorialLink = { href: string; label: string };

export type EditorialH4 = {
  h4: string;
  body: string;
};

export type EditorialH3 = {
  h3: string;
  body: string;
  h4?: EditorialH4[];
};

export type EditorialParagraph = {
  h2: string;
  body: string;
  sourceIds?: string[];
  h3?: EditorialH3[];
};

export type Correction = { at: string; note: string };

export type DiscoverCheck =
  | "INDEXABLE"
  | "LARGE_IMAGE"
  | "IMAGE_GE_1200"
  | "MAX_IMAGE_PREVIEW_LARGE"
  | "HELPFUL_CONTENT"
  | "NON_CLICKBAIT_TITLE"
  | "ORIGINAL_VALUE"
  | "MOBILE_TEMPLATE";

export type EditorialArticle = {
  id: string;
  slug: string;
  slot: SlotId;
  articleType: ArticleType;
  status: ArticleStatus;
  title: string;
  h1: string;
  lead: string;
  paragraphs: EditorialParagraph[];
  createdAt: string;
  publishedAt: string | null;
  modifiedAt: string | null;
  parisDate: string;
  scheduledTime: string;
  category: string;
  section: string;
  league: LeagueId | null;
  teams: string[];
  matchId: string | null;
  competition: string;
  sources: EditorialSource[];
  /** Score interne 0–100 pour choisir un sujet. Pas une probabilité Discover. */
  newsworthiness: number;
  discoverOpportunity: {
    freshness: number;
    frenchInterest: number;
    entityStrength: number;
    novelty: number;
    visual: number;
    sourceQuality: number;
    editorialAngle: number;
    total: number;
    decision: "PUBLISH" | "REJECT" | "REVIEW";
    reasons: string[];
  };
  discoverChecks: Record<DiscoverCheck, boolean>;
  /** Indicateur interne. Pas une probabilité d'apparition. */
  discoverReadiness: number;
  topStories: "TOP_STORIES_ELIGIBILITY_READY" | "NOT_READY";
  image: EditorialImage;
  links: EditorialLink[];
  related: { href: string; title: string }[];
  quality: { pass: boolean; reasons: string[] };
  duplicateScore: number;
  corrections: Correction[];
  sourceChanges: Correction[];
  factHash: string;
  keywords: string;
};

export type SkippedSlot = {
  jobId: string;
  slot: SlotId;
  reason: string;
  topic?: string;
};

export type CandidateView = {
  id: string;
  title: string;
  score: number;
  slotFit: SlotId;
  articleType: ArticleType;
  competition: string;
  sources: string[];
  matchId: string | null;
};

export type TimeChange = {
  slot: SlotId;
  oldTime: string;
  newTime: string;
  reason: string;
  window: string;
};

export type SlotPlan = {
  id: SlotId;
  time: string;
  jobId: string;
  opensAt: string;
  article: EditorialArticle | null;
  skipped: SkippedSlot | null;
};

export type EditorialEdition = {
  parisDate: string;
  generatedAt: string;
  timezone: "Europe/Paris";
  slots: SlotPlan[];
  articles: EditorialArticle[];
  skipped: SkippedSlot[];
  candidates: CandidateView[];
  nextRun: string;
  nextPlanningAt: string;
  times: Record<SlotId, string>;
  timeChanges: TimeChange[];
  maxPerDay: 3;
  targetPerDay: 3;
  publicationPolicy: "THREE_QUALIFIED_ARTICLES" | "OPPORTUNITY_DRIVEN_MAX_3";
  plannedCount: number;
  targetStatus: "MET" | "DEGRADED";
};

export type EditorialMatch = {
  id: string;
  league: LeagueId;
  competition: string;
  kickoff: string;
  venue?: string;
  home: { id?: string; name: string; short?: string };
  away: { id?: string; name: string; short?: string };
  status?: "scheduled" | "live" | "finished" | "cancelled";
  scoreHome?: number | null;
  scoreAway?: number | null;
  clock?: string;
  slug?: string;
  formHome?: string;
  formAway?: string;
  oddsSource?: string;
  notes?: string[];
  opening?: { home?: number; draw?: number; away?: number; book?: string };
  current?: { book?: string; home?: number; draw?: number; away?: number }[];
  importance?: { value?: number; source?: string; confidence?: number; timestamp?: string };
  absencesHome?: { value?: { player?: string; reason?: string }[]; source?: string; confidence?: number };
  absencesAway?: { value?: { player?: string; reason?: string }[]; source?: string; confidence?: number };
  restHome?: { value?: number; source?: string; confidence?: number };
  restAway?: { value?: number; source?: string; confidence?: number };
};

export type EditorialModel = {
  matchId: string;
  timestamp?: string;
  home: number;
  draw: number;
  away: number;
};

export type SlotMetric = {
  samples: number;
  ctr: number | null;
  organicSessions: number | null;
  discoverClicks: number | null;
  suggestedShiftMin: number | null;
};

export type SlotMetrics = Partial<Record<SlotId, SlotMetric>>;

export function isPublicArticle(article: EditorialArticle): boolean {
  return article.status === "PUBLISHED" || article.status === "UPDATED";
}
