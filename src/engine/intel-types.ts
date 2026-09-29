import type { ChangeSeverity } from "./change-detect.ts";
import type { PostMatchEval } from "./post-match.ts";

export type PredictionVersion = {
  predictionId: string;
  matchId: string;
  version: number;
  timestamp: string;
  modelVersion: string;
  homeProbability: number;
  drawProbability: number;
  awayProbability: number;
  expectedGoals: { home: number; away: number };
  likelyScores: { score: string; p: number }[];
  confidence: number;
  reasonForChange: string;
  inputHash: string;
  changeSeverity?: ChangeSeverity;
  evaluation?: PostMatchEval;
};
