/** Queries we care about. Observations stay empty until a human records one. */
export const VISIBILITY_QUERIES = [
  "pronostic football IA",
  "prédiction football IA",
  "analyse match football",
  "BetGPT",
  "BetGPT pronostic",
  "BetGPT avis",
  "BetGPT football",
  "BetGPT analyse match",
] as const;

export type VisibilityObservation = {
  query: string;
  engine: string;
  checkedAt: string | null;
  mentioned: boolean | null;
  url: string;
  citationUrl: string;
  notes: string;
};

export const VISIBILITY_ENGINES = ["Google", "Bing", "ChatGPT Search", "Gemini", "Perplexity", "Claude", "Autre"] as const;

export function emptyObservation(query: string): VisibilityObservation {
  return {
    query,
    engine: "",
    checkedAt: null,
    mentioned: null,
    url: "",
    citationUrl: "",
    notes: "",
  };
}

export function visibilitySeed(): VisibilityObservation[] {
  return VISIBILITY_QUERIES.map((query) => emptyObservation(query));
}
