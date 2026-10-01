import type { EditorialNewsSignal } from "@/lib/editorial/types";
import { jaccard } from "@/lib/editorial/quality";


const MATERIAL_DEVELOPMENT =
  /\b(finalement|autorisé|autorisee?|autorisation|accord(?:é|e)?|confirmé|confirmee?|démenti?|dément|refusé|refusee?|refus|officiel(?:lement)?|verdict|décision|annonce|renonce|annulé|annulee?|suspendu|forfait confirmé|opéré|operation)\b/i;

export function isMaterialDevelopment(text: string): boolean {
  return MATERIAL_DEVELOPMENT.test(text);
}

const NEWSWORTHY = /blessure|blessé|forfait|absent|suspendu|transfert|mercato|accord|signature|prolong|licenci|limog|entra[iî]neur|coach|composition|compo|titulaire|banc|record|qualification|qualifié|élimin|victoire|défaite|exploit|retour|sanction|décision|communiqué|officiel|annonce|nommé|nomination|rupture|contrat|derby|classique|finale/i;

const EVENT_FAMILIES: [RegExp, string][] = [
  [/blessure|blessé|forfait|absent|indisponible/i, "availability"],
  [/transfert|mercato|accord|signature|prolong|contrat/i, "transfer"],
  [/licenci|limog|entra[iî]neur|coach|nommé|nomination/i, "coach"],
  [/composition|compo|titulaire|banc|groupe|sélection/i, "lineup"],
  [/record|exploit|historique/i, "record"],
  [/qualification|qualifié|élimin/i, "qualification"],
  [/sanction|suspendu|décision|communiqué|officiel|annonce/i, "official-decision"],
  [/victoire|défaite|score|résultat|retour|remontée/i, "result"],
];

function eventFamilies(text: string): string[] {
  return EVENT_FAMILIES.filter(([pattern]) => pattern.test(text)).map(([, label]) => label);
}

export type NewsCluster = {
  id: string;
  signals: EditorialNewsSignal[];
  title: string;
  entities: string[];
  official: boolean;
  distinctSources: number;
  publishedAt: string;
  newsworthy: boolean;
};

export function clusterSignals(signals: EditorialNewsSignal[]): NewsCluster[] {
  const clusters: NewsCluster[] = [];
  for (const signal of signals) {
    let best: NewsCluster | null = null;
    let bestScore = 0;
    for (const cluster of clusters) {
      const score = jaccard(signal.title, cluster.title);
      const entityOverlap = signal.entities.some((entity) => cluster.entities.includes(entity));
      const familiesA = eventFamilies(`${signal.title} ${signal.description ?? ""}`);
      const familiesB = eventFamilies(cluster.signals.map((row) => `${row.title} ${row.description ?? ""}`).join(" "));
      const familyOverlap = familiesA.some((family) => familiesB.includes(family));
      const deltaHours = Math.abs(Date.parse(signal.publishedAt) - Date.parse(cluster.publishedAt)) / 36e5;
      const incomingMaterial = isMaterialDevelopment(`${signal.title} ${signal.description ?? ""}`);
      const clusterMaterial = cluster.signals.some((row) =>
        isMaterialDevelopment(`${row.title} ${row.description ?? ""}`),
      );
      // A later confirmation / denial / authorization / official decision is a new editorial development,
      // not merely another corroborating mention of the earlier rumor or controversy.
      const materialStateChange =
        entityOverlap &&
        incomingMaterial &&
        !clusterMaterial &&
        deltaHours >= 0.35;
      const sharedEntityCount = signal.entities.filter((entity) => cluster.entities.includes(entity)).length;
      const sameMaterialDevelopment =
        entityOverlap &&
        incomingMaterial &&
        clusterMaterial &&
        deltaHours <= 12 &&
        sharedEntityCount >= Math.min(2, Math.max(1, Math.min(signal.entities.length, cluster.entities.length)));
      const sameStory =
        !materialStateChange &&
        (score >= 0.34 ||
          (entityOverlap && score >= 0.24) ||
          (entityOverlap && familyOverlap && deltaHours <= 12) ||
          sameMaterialDevelopment);
      if (sameStory && (score > bestScore || (best == null && familyOverlap))) {
        best = cluster;
        bestScore = Math.max(score, familyOverlap ? 0.25 : score);
      }
    }
    if (!best) {
      clusters.push({
        id: `cluster-${signal.id}`,
        signals: [signal],
        title: signal.title,
        entities: [...signal.entities],
        official: signal.sourceTier === "OFFICIAL",
        distinctSources: 1,
        publishedAt: signal.publishedAt,
        newsworthy: NEWSWORTHY.test(`${signal.title} ${signal.description ?? ""}`),
      });
      continue;
    }
    best.signals.push(signal);
    best.entities = [...new Set([...best.entities, ...signal.entities])];
    best.official = best.official || signal.sourceTier === "OFFICIAL";
    best.distinctSources = new Set(best.signals.map((row) => row.sourceName.toLowerCase())).size;
    if (signal.publishedAt > best.publishedAt) best.publishedAt = signal.publishedAt;
    best.newsworthy =
      best.newsworthy || NEWSWORTHY.test(`${signal.title} ${signal.description ?? ""}`);
    const stronger = best.signals
      .slice()
      .sort((a, b) => {
        const tier = (x: EditorialNewsSignal) =>
          x.sourceTier === "OFFICIAL" ? 3 : x.sourceTier === "TIER1" ? 2 : 1;
        return tier(b) - tier(a) || b.publishedAt.localeCompare(a.publishedAt);
      })[0];
    if (stronger) best.title = stronger.title;
  }
  return clusters.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export function autoPublishableCluster(cluster: NewsCluster): boolean {
  const material = cluster.signals.some((signal) =>
    isMaterialDevelopment(`${signal.title} ${signal.description ?? ""}`),
  );
  if (!cluster.newsworthy && !material) return false;
  if (cluster.official) return true;
  const strong = cluster.signals.filter(
    (signal) => signal.sourceTier === "TIER1" || signal.sourceTier === "OFFICIAL",
  );
  return (
    cluster.distinctSources >= 2 &&
    new Set(strong.map((signal) => signal.sourceName.toLowerCase())).size >= 2
  );
}
