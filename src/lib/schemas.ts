import { z } from "zod";

export const seasonIdSchema = z.enum(["all", "current", "prev", "last-3", "last-5"]);

export const hunterSlugSchema = z
  .string()
  .min(1)
  .max(40)
  .regex(/^[a-z0-9-]+$/);

export const matchIdSchema = z.string().min(1).max(120);

export const pinSchema = z.string().min(1).max(128);

export const pinBodySchema = z.object({ pin: pinSchema });

export const analyticsIngestSchema = z.object({
  e: z.string().min(1).max(40),
  p: z.string().max(80).optional(),
  route: z.string().max(120).optional(),
  s: z.enum(["google", "bing", "duckduckgo", "yahoo", "ecosia", "qwant", "brave", "yandex", "baidu"]).optional(),
});

export const affiliateClickSchema = z.object({
  url: z.string().url().max(800),
  book: z.string().min(1).max(40),
  matchId: z.string().max(80).optional().default(""),
});

export const chatMessageSchema = z.object({
  id: z.string().max(80).optional(),
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000),
  timestamp: z.number().optional(),
});

export const chatBodySchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(12),
  requestedMode: z.enum(["NORMAL", "ROAST"]).optional(),
  userMemory: z.unknown().optional(),
});

export const explorerQuerySchema = z.object({
  league: z.string().max(40).optional(),
  season: z.string().max(20).optional(),
  lastN: z.number().int().positive().max(5000).optional(),
});

export const radarQuerySchema = z.object({
  season: z.string().max(20).optional(),
  sort: z.enum(["low", "high"]).optional(),
});

export const homeSliceSchema = z.object({
  offset: z.number().int().min(0).max(2000),
  league: z.string().min(1).max(8),
});

export const explainSchema = z.object({
  matchId: matchIdSchema,
  market: z.string().max(40).optional(),
});

export const idParamSchema = z.object({
  id: matchIdSchema,
});

export const hunterSlugParamSchema = z.object({
  slug: hunterSlugSchema,
});
