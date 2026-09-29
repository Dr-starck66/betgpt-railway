import type { AblationRow, ChampionshipBoard, ModelMetric } from "./types.ts";

export type ModelScoreboard = {
  ranked: ModelMetric[];
  primary: "brier";
  baseline: AblationRow | null;
  candidate: AblationRow | null;
  tacticalHelps: boolean;
  accuracySecondary: true;
  roiLabel: string;
  notes: string[];
};

const ROI_LABEL = "ROI simulé historique — pas un gain client.";

/** Prefer calibrated probabilities (Brier / LogLoss) over raw accuracy. */
export function scoreboardOf(board: ChampionshipBoard): ModelScoreboard {
  const ranked = [...board.models, ...board.coaches, board.tactical, board.ensemble]
    .filter(Boolean)
    .sort((a, b) => a.brier - b.brier || a.logLoss - b.logLoss);
  const baseline = board.ablation.find((a) => a.name === "BASELINE") ?? null;
  const candidate = board.ablation.find((a) => a.name === "TACTICAL") ?? null;
  const tacticalHelps = Boolean(baseline && candidate && candidate.brier < baseline.brier - 0.002);
  const notes: string[] = [
    "Le Brier et le LogLoss priment. Le taux de hits est secondaire.",
    ROI_LABEL,
  ];
  if (baseline && candidate) {
    notes.push(
      tacticalHelps
        ? "La lecture du match améliore le Brier par rapport au modèle de base."
        : "La lecture du match n'améliore pas assez le Brier. Les chiffres restent le juge.",
    );
  }
  return {
    ranked,
    primary: "brier",
    baseline,
    candidate,
    tacticalHelps,
    accuracySecondary: true,
    roiLabel: ROI_LABEL,
    notes,
  };
}

export function pickDeployable(board: ChampionshipBoard): { name: string; reason: string } {
  const s = scoreboardOf(board);
  const best = s.ranked[0];
  if (!best) return { name: "ensemble", reason: "Pas assez d'échantillon." };
  return {
    name: best.name,
    reason: `Meilleur Brier ${best.brier.toFixed(3)} sur ${best.n} matchs (LogLoss ${best.logLoss.toFixed(3)}).`,
  };
}
