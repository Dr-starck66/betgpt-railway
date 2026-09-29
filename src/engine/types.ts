import type { RecentLine } from "./team-form.ts";

export type LeagueId = "PL" | "LL" | "BL" | "SA" | "L1" | "ER" | "PT" | "SC" | "TR" | "CL" | "EL" | "NL";

export type Decision = "BET" | "WATCH" | "NO_BET";

export type DataProvenance =
  | "PROVIDER_OBSERVED"
  | "DERIVED_FROM_REAL_DATA"
  | "MODEL_ESTIMATE"
  | "SYNTHETIC_TEST";

/** TeamProfile attack/xG/PPDA/possession/press are MODEL_ESTIMATE proxies, not ESPN-observed xG. */
export const TEAM_PROFILE_PROVENANCE: DataProvenance = "MODEL_ESTIMATE";

export type MarketKind =
  | "1X2_H"
  | "1X2_D"
  | "1X2_A"
  | "DC_1X"
  | "DC_X2"
  | "DC_12"
  | "DNB_H"
  | "DNB_A"
  | "OU_15_O"
  | "OU_25_O"
  | "OU_35_O"
  | "OU_25_U"
  | "BTTS_Y"
  | "BTTS_N";

export type CoachAgentId =
  | "POSSESSION_STRUCTURAL"
  | "PRESSING_TRANSITION"
  | "ADAPTATION_GAME_MANAGEMENT"
  | "DEFENSIVE_COUNTER"
  | "COMPETITIVE_DISCIPLINE";

export type DataPoint<T> = {
  value: T;
  source: string;
  timestamp: string;
  confidence: number;
  freshnessHours: number;
};

export type Absence = {
  player: string;
  role: "star" | "starter" | "rotation";
  reason: "injury" | "suspension" | "rotation";
  importance: number;
};

export type TeamProfile = {
  id: string;
  name: string;
  short: string;
  league: LeagueId;
  attack: number;
  defense: number;
  elo: number;
  xgFor: number;
  xgAgainst: number;
  possession: number;
  ppda: number;
  fieldTilt: number;
  progressivePasses: number;
  highTurnovers: number;
  recoveries: number;
  compactness: number;
  setPieceXg: number;
  duelWin: number;
  cardsPerGame: number;
  flexibility: number;
  pressLine: number;
  buildup: number;
  depth: number;
  formation: string;
  color: string;
  logo?: string;
};

export type BookOdds = {
  book: string;
  home: number;
  draw: number;
  away: number;
  over15: number;
  over25: number;
  over35: number;
  under25: number;
  bttsYes: number;
  bttsNo: number;
  cs11?: number;
  cs?: Record<string, number>;
  url?: string;
  homeUrl?: string;
  drawUrl?: string;
  awayUrl?: string;
  /** ISO timestamp when this bookmaker quote snapshot was observed. */
  observedAt?: string;
};

export type MatchStatus = "scheduled" | "live" | "finished" | "cancelled";

export type MatchIncident = {
  minute: string;
  kind: "goal" | "own_goal" | "penalty" | "yellow" | "red" | "sub" | "other";
  player: string;
  assist?: string;
  side: "home" | "away";
  label: string;
};

export type MatchInput = {
  id: string;
  league: LeagueId;
  competition: string;
  kickoff: string;
  venue: string;
  referee?: DataPoint<string>;
  home: TeamProfile;
  away: TeamProfile;
  restHome: DataPoint<number>;
  restAway: DataPoint<number>;
  travelAwayKm: DataPoint<number>;
  congestionHome: DataPoint<number>;
  congestionAway: DataPoint<number>;
  absencesHome: DataPoint<Absence[]>;
  absencesAway: DataPoint<Absence[]>;
  importance: DataPoint<number>;
  opening: BookOdds;
  current: BookOdds[];
  notes: string[];
  status?: MatchStatus;
  voidReason?: "postponed" | "cancelled" | "abandoned";
  scoreHome?: number;
  scoreAway?: number;
  clock?: string;
  incidents?: MatchIncident[];
  slug?: string;
  phase?: string;
  phaseLabel?: string;
  formHome?: string;
  formAway?: string;
  /** Newest-first results observed before kickoff. Empty means not observed, not a blank run. */
  recentHome?: RecentLine[];
  recentAway?: RecentLine[];
  oddsSource?: string;
  listedTotal?: number;
  cs11Odds?: number;
  ticketLinks?: { book: string; url: string }[];
};

export type ScoreProbs = {
  lambdaHome: number;
  lambdaAway: number;
  home: number;
  draw: number;
  away: number;
  over15: number;
  over25: number;
  over35: number;
  under25: number;
  bttsYes: number;
  bttsNo: number;
  matrix: number[][];
};

export type ModelName =
  | "poisson"
  | "dixonColes"
  | "elo"
  | "xg"
  | "glm"
  | "market";

export type ModelOutput = ScoreProbs & {
  model: ModelName;
  version: string;
};

export type EnsembleOutput = ScoreProbs & {
  weights: Record<ModelName, number>;
  disagreement: number;
};

export type CoachSignals = Record<string, number>;

export type CoachAgentOutput = {
  agent: CoachAgentId;
  matchId: string;
  analysisTimestamp: string;
  signals: CoachSignals;
  marketImplications: { home: number; draw: number; away: number };
  confidence: number;
  keyReasons: string[];
  contradictions: string[];
  missingInformation: string[];
  dataQuality: number;
  weight: number;
};

export type DevilsAdvocateOutput = {
  predictionChallengeScore: number;
  riskFactors: string[];
  alternativeScenario: string;
  confidenceReduction: number;
};

export type TacticalConsensus = {
  home: number;
  draw: number;
  away: number;
  disagreement: number;
  conflictScore: number;
  directionalAgreement: number;
  marketAgreement: number;
  statisticalAgreement: number;
  confidenceWeighted: boolean;
};

export type TacticalMeta = {
  tacticalAdjustment: { home: number; draw: number; away: number };
  tacticalReliability: number;
  blended: { home: number; draw: number; away: number };
};

export type TacticalFeature = {
  key: string;
  value: number;
  source: string;
  timestamp: string;
  confidence: number;
  freshnessHours: number;
  version: string;
};

export type ScenarioId =
  | "favorite_scores_first"
  | "underdog_scores_first"
  | "stalemate_late"
  | "red_card_favorite"
  | "early_goal"
  | "favorite_chasing"
  | "underdog_protects"
  | "high_press_success"
  | "high_press_failure";

export type ScenarioResult = {
  id: ScenarioId;
  label: string;
  description: string;
  home: number;
  draw: number;
  away: number;
  over25: number;
  bttsYes: number;
};

export type CoverBet = {
  market: MarketKind | "CS_11" | "CS";
  label: string;
  selection: string;
  odds: number;
  book: string;
  url?: string;
  listed: boolean;
  stakePct: number;
  totalStakePct: number;
  ifMainWins: number;
  ifCoverWins: number;
};

export type MarketQuote = {
  market: MarketKind;
  label: string;
  group: string;
  selection: string;
  modelProb: number;
  fairOdds: number;
  bestOdds: number;
  bestBook: string;
  bestBookUrl?: string;
  implied: number;
  edge: number;
  ev: number;
  stakePct: number;
  listed: boolean;
  premium: boolean;
  opportunityScore: number;
  decision: Decision;
  rejectionReason?: string;
  cover?: CoverBet;
  clPhaseBest?: boolean;
  elPhaseBest?: boolean;
};

export type CalibratedProbs = {
  home: number;
  draw: number;
  away: number;
  over15: number;
  over25: number;
  over35: number;
  under25: number;
  bttsYes: number;
  bttsNo: number;
  method: "platt" | "isotonic" | "none";
  version: string;
};

export type Intelligence = {
  modelDisagreement: number;
  confidenceScore: number;
  dataQuality: number;
};

export type LiveSuperBet = {
  pick: string;
  label: string;
  cover: string;
  p: number;
  minute: number;
  why: string;
};

export type PredictionRecord = {
  matchId: string;
  engineVersion: string;
  tacticalVersion: string;
  kickoff: string;
  league: LeagueId;
  competition: string;
  venue: string;
  home: { id: string; name: string; short: string; formation: string; logo?: string; color?: string };
  away: { id: string; name: string; short: string; formation: string; logo?: string; color?: string };
  models: ModelOutput[];
  ensemble: EnsembleOutput;
  calibrated: CalibratedProbs;
  intelligence: Intelligence;
  coaches: CoachAgentOutput[];
  agentWeights: Record<CoachAgentId, number>;
  consensus: TacticalConsensus;
  devil: DevilsAdvocateOutput;
  meta: TacticalMeta;
  features: TacticalFeature[];
  scenarios: ScenarioResult[];
  markets: MarketQuote[];
  bookLinks: { book: string; url: string }[];
  dailyBestCandidate: boolean;
  clPhaseBest?: boolean;
  elPhaseBest?: boolean;
  notes: string[];
  liveSuper?: LiveSuperBet | null;
  availableInformation: string[];
  timestamp: string;
  live?: {
    confidence10: number;
    freshnessMinutes: number | null;
    freshnessLabel: string;
    valueDelta: { home: number; draw: number; away: number } | null;
    consensus: { home: number; draw: number; away: number } | null;
    consensusStatus: "VERIFIED" | "UNVERIFIED" | "UNKNOWN" | "CONFLICT";
    oddsConflicts: { bookA: string; bookB: string; side: string; delta: number }[];
    uncertainty: string[];
    unknown: string[];
    likelyScores: { score: string; p: number }[];
    expectedGoals: { home: number; away: number };
    components?: {
      score10: number;
      dataCompleteness: number;
      dataFreshness: number;
      sourceAgreement: number;
      modelAgreement: number;
      lineupCertainty: number;
      marketStability: number;
      historicalCalibration: number;
    };
  };
};

export type DataSourceKind = "official-history" | "live-provider" | "market" | "synthetic-test";

export type HistoricalMatch = {
  id: string;
  league: LeagueId;
  kickoff: string;
  homeId: string;
  awayId: string;
  homeName?: string;
  awayName?: string;
  goalsHome: number;
  goalsAway: number;
  oddsHome: number;
  oddsDraw: number;
  oddsAway: number;
  closingHome: number;
  closingDraw: number;
  closingAway: number;
  sourceKind?: DataSourceKind;
};

export type ModelMetric = {
  name: string;
  n: number;
  brier: number;
  logLoss: number;
  accuracy: number;
  directional: number;
  clv: number;
  roi: number;
  yield: number;
  ece: number;
  hitRate: number;
};

export type AblationRow = {
  name: "BASELINE" | "TACTICAL" | "TACTICAL_DEVIL";
  brier: number;
  logLoss: number;
  ece: number;
  roi: number;
  clv: number;
  hitRate: number;
  n: number;
};

export type ChampionshipBoard = {
  models: ModelMetric[];
  coaches: ModelMetric[];
  tactical: ModelMetric;
  ensemble: ModelMetric;
  ablation: AblationRow[];
  walkForward: { fold: string; brierBase: number; brierTactical: number }[];
  agentLeague: Record<CoachAgentId, Partial<Record<LeagueId, number>>>;
};

export type DeskSummary = {
  asOf: string;
  nMatches: number;
  nBet: number;
  nWatch: number;
  nNoBet: number;
  meanAbsEdge: number;
};
