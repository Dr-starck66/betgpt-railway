import { clamp } from "./math.ts";

export type PostMatchEval = {
  actualResult: "H" | "D" | "A";
  actualScore: { home: number; away: number };
  predictedProbabilities: { home: number; draw: number; away: number };
  predictedScore: string | null;
  brier: number;
  logLoss: number;
  calibrationBucket: string;
  modelVersion: string;
};

function outcome(gh: number, ga: number): "H" | "D" | "A" {
  if (gh > ga) return "H";
  if (gh === ga) return "D";
  return "A";
}

function brier3(p: { home: number; draw: number; away: number }, y: "H" | "D" | "A"): number {
  const th = y === "H" ? 1 : 0;
  const td = y === "D" ? 1 : 0;
  const ta = y === "A" ? 1 : 0;
  return (p.home - th) ** 2 + (p.draw - td) ** 2 + (p.away - ta) ** 2;
}

function logLoss3(p: { home: number; draw: number; away: number }, y: "H" | "D" | "A"): number {
  const q = y === "H" ? p.home : y === "D" ? p.draw : p.away;
  return -Math.log(clamp(q, 1e-6, 1));
}

export function calibrationBucket(p: number): string {
  if (p < 0.2) return "0–20 %";
  if (p < 0.4) return "20–40 %";
  if (p < 0.6) return "40–60 %";
  if (p < 0.8) return "60–80 %";
  return "80–100 %";
}

export function evaluateClosing(
  version: {
    homeProbability: number;
    drawProbability: number;
    awayProbability: number;
    likelyScores: { score: string; p: number }[];
    modelVersion: string;
  },
  goalsHome: number,
  goalsAway: number,
): PostMatchEval {
  const p = {
    home: version.homeProbability,
    draw: version.drawProbability,
    away: version.awayProbability,
  };
  const y = outcome(goalsHome, goalsAway);
  const pickP = y === "H" ? p.home : y === "D" ? p.draw : p.away;
  return {
    actualResult: y,
    actualScore: { home: goalsHome, away: goalsAway },
    predictedProbabilities: p,
    predictedScore: version.likelyScores[0]?.score ?? null,
    brier: brier3(p, y),
    logLoss: logLoss3(p, y),
    calibrationBucket: calibrationBucket(pickP),
    modelVersion: version.modelVersion,
  };
}
