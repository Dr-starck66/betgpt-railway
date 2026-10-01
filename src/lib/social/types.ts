export type SocialNetwork = "x";

export type SocialJobStatus =
  | "READY_TO_X"
  | "QUEUED"
  | "PUBLISHING"
  | "PUBLISHED"
  | "RETRY"
  | "FAILED"
  | "SKIPPED";

export type SocialPublication = {
  id: string;
  articleId: string;
  articleSlug: string;
  articleTitle: string;
  articleUrl: string;
  trackedUrl: string;
  network: SocialNetwork;
  text: string;
  hashtags: string[];
  imageUrl: string | null;
  createdAt: string;
  scheduledAt: string;
  attemptedAt: string | null;
  publishedAt: string | null;
  status: SocialJobStatus;
  remotePostId: string | null;
  remotePostUrl: string | null;
  error: string | null;
  retryCount: number;
};

export type XProviderState =
  | "READY_NOT_AUTHORIZED"
  | "CONFIGURED"
  | "DISABLED"
  | "ERROR";

export type SocialProviderHealth = {
  network: SocialNetwork;
  state: XProviderState;
  autoPublish: boolean;
  reason: string;
};

export type SocialSyncResult = {
  created: SocialPublication[];
  persisted: boolean;
  provider: SocialProviderHealth;
  publishAttempts: number;
};
