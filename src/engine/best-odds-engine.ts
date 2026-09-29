import type { BookOdds, MarketKind } from "./types.ts";
import { lowScoringNoBetGate, type LowScoringContext } from "./low-scoring-no-bet-gate.ts";
import {
  listedHedgeQuotes,
  type ListedExactScoreQuote,
} from "./exact-score-book-odds.ts";
import {
  selectiveScoreHedge,
  DEFAULT_SCORE_HEDGE_POLICY,
  type ScoreHedgeDecision,
  type ScoreHedgePolicy,
} from "./selective-score-hedge.ts";

export const DEFAULT_MAX_QUOTE_AGE_MS = 5 * 60_000;

export type BestOddsMainQuote = {
  market: "1X2_H" | "1X2_D" | "1X2_A";
  odds: number;
  book: string;
  url?: string;
  observedAt?: string;
  ageMs: number | null;
};

export type CrossBookOddsPolicy = {
  maxQuoteAgeMs: number;
  requireTimestampWhenLive: boolean;
  minMainOdds: number;
  maxMainOdds: number;
  minMainEv: number;
  minPortfolioRoiUplift: number;
};

export const DEFAULT_CROSS_BOOK_ODDS_POLICY: CrossBookOddsPolicy = Object.freeze({
  maxQuoteAgeMs: DEFAULT_MAX_QUOTE_AGE_MS,
  requireTimestampWhenLive: true,
  minMainOdds: 1.8,
  maxMainOdds: 4.2,
  minMainEv: 0,
  // ROI-first: a hedge is retained only if expected ROI per total capital does
  // not dilute the main-only expected ROI.
  minPortfolioRoiUplift: 0,
});

function parsedMs(v?: string): number | null {
  if (!v) return null;
  const ms = Date.parse(v);
  return Number.isFinite(ms) ? ms : null;
}

export function freshBookSnapshots(
  books: BookOdds[],
  nowMs = Date.now(),
  maxAgeMs = DEFAULT_MAX_QUOTE_AGE_MS,
  requireTimestamp = true,
): BookOdds[] {
  const anyTimestamped = books.some((b) => parsedMs(b.observedAt) !== null);
  if (!anyTimestamped && !requireTimestamp) return books;
  if (!anyTimestamped) return [];
  return books.filter((b) => {
    const t = parsedMs(b.observedAt);
    if (t === null) return false;
    const age = nowMs - t;
    return age >= -60_000 && age <= maxAgeMs;
  });
}

function oddsForMain(book: BookOdds, market: BestOddsMainQuote["market"]): number {
  if (market === "1X2_H") return book.home;
  if (market === "1X2_D") return book.draw;
  return book.away;
}

function urlForMain(book: BookOdds, market: BestOddsMainQuote["market"]): string | undefined {
  if (market === "1X2_H") return book.homeUrl ?? book.url;
  if (market === "1X2_D") return book.drawUrl ?? book.url;
  return book.awayUrl ?? book.url;
}

export function bestFreshMainQuote(
  books: BookOdds[],
  market: BestOddsMainQuote["market"],
  opts: { nowMs?: number; maxAgeMs?: number; requireTimestamp?: boolean } = {},
): BestOddsMainQuote | null {
  const nowMs = opts.nowMs ?? Date.now();
  const fresh = freshBookSnapshots(
    books,
    nowMs,
    opts.maxAgeMs ?? DEFAULT_MAX_QUOTE_AGE_MS,
    opts.requireTimestamp ?? true,
  );
  let best: BestOddsMainQuote | null = null;
  for (const b of fresh) {
    const odds = oddsForMain(b, market);
    if (!Number.isFinite(odds) || odds <= 1) continue;
    const t = parsedMs(b.observedAt);
    const q: BestOddsMainQuote = {
      market,
      odds,
      book: b.book,
      url: urlForMain(b, market),
      observedAt: b.observedAt,
      ageMs: t === null ? null : Math.max(0, nowMs - t),
    };
    if (!best || q.odds > best.odds + 0.0001) best = q;
  }
  return best;
}

export function bestFreshHedgeQuotes(
  books: BookOdds[],
  market: MarketKind,
  opts: { nowMs?: number; maxAgeMs?: number; requireTimestamp?: boolean } = {},
): { oneOne: ListedExactScoreQuote | null; opponent21: ListedExactScoreQuote | null } {
  const fresh = freshBookSnapshots(
    books,
    opts.nowMs ?? Date.now(),
    opts.maxAgeMs ?? DEFAULT_MAX_QUOTE_AGE_MS,
    opts.requireTimestamp ?? true,
  );
  return listedHedgeQuotes(fresh, market);
}

export type CrossBookExecutionPlan = {
  status: "BET" | "NO_BET";
  reason: string;
  main: BestOddsMainQuote | null;
  mainModelProb: number;
  mainStake: number;
  mainExpectedPnl: number;
  mainExpectedRoi: number;
  hedgeDecision: ScoreHedgeDecision | null;
  hedgeBook: string | null;
  hedgeUrl?: string;
  totalCapital: number;
  combinedExpectedPnl: number;
  combinedExpectedRoi: number;
  crossBook: boolean;
};

export function buildCrossBookExecutionPlan(input: {
  books: BookOdds[];
  league: Parameters<typeof selectiveScoreHedge>[0]["league"];
  market: "1X2_H" | "1X2_A";
  mainModelProb: number;
  mainStake: number;
  p11: number;
  pOpponent21: number;
  scoringContext?: LowScoringContext;
  nowMs?: number;
  oddsPolicy?: Partial<CrossBookOddsPolicy>;
  hedgePolicy?: ScoreHedgePolicy;
}): CrossBookExecutionPlan {
  const oddsPolicy = { ...DEFAULT_CROSS_BOOK_ODDS_POLICY, ...(input.oddsPolicy ?? {}) };
  const main = bestFreshMainQuote(input.books, input.market, {
    nowMs: input.nowMs,
    maxAgeMs: oddsPolicy.maxQuoteAgeMs,
    requireTimestamp: oddsPolicy.requireTimestampWhenLive,
  });
  const empty = (reason: string): CrossBookExecutionPlan => ({
    status: "NO_BET",
    reason,
    main,
    mainModelProb: input.mainModelProb,
    mainStake: input.mainStake,
    mainExpectedPnl: 0,
    mainExpectedRoi: 0,
    hedgeDecision: null,
    hedgeBook: null,
    totalCapital: 0,
    combinedExpectedPnl: 0,
    combinedExpectedRoi: 0,
    crossBook: false,
  });
  if (!(input.mainStake > 0) || !Number.isFinite(input.mainStake)) return empty("INVALID_MAIN_STAKE");
  const lowScoringGate = lowScoringNoBetGate(input.scoringContext);
  if (lowScoringGate.blockBet) return empty(lowScoringGate.reason);
  if (!main) return empty("NO_FRESH_LISTED_MAIN_QUOTE");
  if (main.odds < oddsPolicy.minMainOdds) return empty("MAIN_BELOW_ACTIVE_ODDS_FLOOR");
  if (main.odds > oddsPolicy.maxMainOdds) return empty("MAIN_ABOVE_ALLOWED_ODDS_CEILING");
  const mainEv = input.mainModelProb * main.odds - 1;
  if (!Number.isFinite(mainEv) || mainEv < oddsPolicy.minMainEv) return empty("MAIN_EV_BELOW_THRESHOLD");

  const mainExpectedPnl = input.mainStake * mainEv;
  const mainExpectedRoi = mainExpectedPnl / input.mainStake;
  const hedgeQuotes = bestFreshHedgeQuotes(input.books, input.market, {
    nowMs: input.nowMs,
    maxAgeMs: oddsPolicy.maxQuoteAgeMs,
    requireTimestamp: oddsPolicy.requireTimestampWhenLive,
  });
  let hedgeDecision = selectiveScoreHedge(
    {
      league: input.league,
      market: input.market,
      mainOdds: main.odds,
      mainStake: input.mainStake,
      mainModelProb: input.mainModelProb,
      p11: input.p11,
      pOpponent21: input.pOpponent21,
      listed11Odds: hedgeQuotes.oneOne?.odds ?? null,
      listedOpponent21Odds: hedgeQuotes.opponent21?.odds ?? null,
      scoringContext: input.scoringContext,
    },
    input.hedgePolicy ?? DEFAULT_SCORE_HEDGE_POLICY,
  );

  let hedgeBook: string | null = null;
  let hedgeUrl: string | undefined;
  let totalCapital = input.mainStake;
  let combinedExpectedPnl = mainExpectedPnl;
  let combinedExpectedRoi = mainExpectedRoi;
  let crossBook = false;

  if (hedgeDecision.selected) {
    const h = hedgeDecision.selected;
    const q = h.scoreLabel === "1-1" ? hedgeQuotes.oneOne : hedgeQuotes.opponent21;
    hedgeBook = q?.book ?? null;
    hedgeUrl = q?.url;
    const hedgeExpectedPnl = h.hedgeStake * h.exactScoreEv;
    const candidateCapital = input.mainStake + h.hedgeStake;
    const candidateExpectedPnl = mainExpectedPnl + hedgeExpectedPnl;
    const candidateExpectedRoi = candidateExpectedPnl / candidateCapital;
    const roiLift = candidateExpectedRoi - mainExpectedRoi;
    if (roiLift + 1e-12 >= oddsPolicy.minPortfolioRoiUplift) {
      totalCapital = candidateCapital;
      combinedExpectedPnl = candidateExpectedPnl;
      combinedExpectedRoi = candidateExpectedRoi;
      crossBook = Boolean(hedgeBook && hedgeBook !== main.book);
    } else {
      hedgeDecision = {
        eligible: false,
        execute: false,
        status: "NO_HEDGE",
        reason: "HEDGE_DILUTES_EXPECTED_PORTFOLIO_ROI",
        selected: null,
        considered: hedgeDecision.considered,
      };
      hedgeBook = null;
      hedgeUrl = undefined;
    }
  }

  return {
    status: "BET",
    reason: hedgeDecision.selected ? "BEST_ODDS_MAIN_AND_SELECTIVE_HEDGE_QUALIFIED" : "BEST_ODDS_MAIN_ONLY",
    main,
    mainModelProb: input.mainModelProb,
    mainStake: input.mainStake,
    mainExpectedPnl,
    mainExpectedRoi,
    hedgeDecision,
    hedgeBook,
    hedgeUrl,
    totalCapital,
    combinedExpectedPnl,
    combinedExpectedRoi,
    crossBook,
  };
}
