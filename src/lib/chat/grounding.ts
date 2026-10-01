const GROUNDING_WORD_EXCEPTIONS = new Set([
  "BetGPT", "ROI", "BTTS", "EV", "CLV", "BET", "WATCH", "NO_BET",
  "Je", "Tu", "Il", "Elle", "Nous", "Vous", "Ils", "Elles",
  "Le", "La", "Les", "Un", "Une", "Des", "Du", "De", "Pour", "Si",
  "Aucun", "Aucune", "Cette", "Ce", "Ces", "Mon", "Ton", "Votre",
]);

function normalizeGroundingText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function hasUnsupportedGroundedClaim(answer: string, source: string): boolean {
  const normalizedAnswer = normalizeGroundingText(answer);
  const absoluteClaimMarkers = ["jamais", "toujours", "record", "historique", "de l'histoire"];
  for (const marker of absoluteClaimMarkers) {
    if (normalizedAnswer.includes(marker) && !normalizeGroundingText(source).includes(marker)) return true;
  }
  const normalizedSource = normalizeGroundingText(source);
  const sensitivePatterns = [
    /\b\d{1,2}\s*[hH:]\s*\d{2}\b/g,
    /\b\d{1,2}[/.]\d{1,2}(?:[/.]\d{2,4})?\b/g,
    /\b\d{1,2}\s*[-–]\s*\d{1,2}\b/g,
    /\b\d+(?:[.,]\d+)?\s*%\b/g,
    /\b\d+[.,]\d{1,3}\b/g,
  ];
  for (const pattern of sensitivePatterns) {
    for (const match of answer.matchAll(pattern)) {
      const fact = normalizeGroundingText(match[0]).replace(/\s+/g, "");
      const haystack = normalizedSource.replace(/\s+/g, "");
      if (fact && !haystack.includes(fact)) return true;
    }
  }

  const properWords = answer.match(/\b[\p{Lu}][\p{L}'’.\-]{2,}\b/gu) ?? [];
  for (const word of properWords) {
    if (GROUNDING_WORD_EXCEPTIONS.has(word)) continue;
    const key = normalizeGroundingText(word);
    if (key && !normalizedSource.includes(key)) return true;
  }
  return false;
}
