/** Free product stays complete. These flags only gate extras. */
export const PRO_FEATURES = {
  exportCsv: false,
  customAlerts: false,
  modelCompare: false,
  advancedFilters: false,
} as const;

export type ProFeature = keyof typeof PRO_FEATURES;

export function isProUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem("betgpt-pro") === "1";
  } catch {
    return false;
  }
}

export function proEnabled(feature: ProFeature): boolean {
  if (PRO_FEATURES[feature]) return true;
  return isProUnlocked();
}
