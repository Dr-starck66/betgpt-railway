import type { Absence, MatchInput, MatchStatus } from "./types.ts";

export type ChangeSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ChangeEvent = {
  kind:
    | "injury"
    | "suspension"
    | "manager"
    | "lineup"
    | "odds"
    | "postponement"
    | "venue"
    | "form"
    | "status";
  label: string;
  severity: ChangeSeverity;
};

export type ChangeReport = {
  severity: ChangeSeverity;
  events: ChangeEvent[];
  shouldRecalc: boolean;
};

export type MatchSnapshot = {
  absencesHome: Absence[];
  absencesAway: Absence[];
  formHome?: string;
  formAway?: string;
  formationHome: string;
  formationAway: string;
  venue: string;
  status?: MatchStatus;
  voidReason?: MatchInput["voidReason"];
  current: { book: string; home: number; draw: number; away: number }[];
};

export function snapshotOf(match: MatchInput): MatchSnapshot {
  return {
    absencesHome: match.absencesHome.value ?? [],
    absencesAway: match.absencesAway.value ?? [],
    formHome: match.formHome,
    formAway: match.formAway,
    formationHome: match.home.formation,
    formationAway: match.away.formation,
    venue: match.venue,
    status: match.status,
    voidReason: match.voidReason,
    current: (match.current ?? []).slice(0, 6).map((b) => ({
      book: b.book,
      home: b.home,
      draw: b.draw,
      away: b.away,
    })),
  };
}

const RANK: Record<ChangeSeverity, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

function maxSev(events: ChangeEvent[]): ChangeSeverity {
  let best: ChangeSeverity = "LOW";
  for (const e of events) if (RANK[e.severity] > RANK[best]) best = e.severity;
  return events.length ? best : "LOW";
}

function absKey(list: Absence[]): string {
  return [...list]
    .map((a) => `${a.player}:${a.reason}:${a.role}`)
    .sort()
    .join("|");
}

function oddsMove(prev?: MatchSnapshot, next?: MatchSnapshot): number {
  const a = (prev?.current ?? []).find((b) => b.home >= 1.05);
  const b = (next?.current ?? []).find((b) => b.home >= 1.05);
  if (!a || !b) return 0;
  return Math.max(
    Math.abs(Math.log(b.home / a.home)),
    Math.abs(Math.log(b.draw / a.draw)),
    Math.abs(Math.log(b.away / a.away)),
  );
}

function newAbsences(prev: Absence[], next: Absence[]): Absence[] {
  const have = new Set(prev.map((a) => `${a.player}:${a.reason}`));
  return next.filter((a) => !have.has(`${a.player}:${a.reason}`));
}

/** Compare two match snapshots. Missing prev → empty report (first version). */
export function detectChanges(prev: MatchSnapshot | null, next: MatchSnapshot): ChangeReport {
  if (!prev) return { severity: "LOW", events: [], shouldRecalc: false };
  const events: ChangeEvent[] = [];

  if (next.voidReason && next.voidReason !== prev.voidReason) {
    events.push({
      kind: "postponement",
      label:
        next.voidReason === "postponed"
          ? "Match reporté"
          : next.voidReason === "cancelled"
            ? "Match annulé"
            : "Match abandonné",
      severity: "CRITICAL",
    });
  }
  if ((next.status ?? "scheduled") !== (prev.status ?? "scheduled")) {
    events.push({
      kind: "status",
      label: `Statut ${prev.status ?? "scheduled"} → ${next.status ?? "scheduled"}`,
      severity: next.status === "cancelled" ? "CRITICAL" : "MEDIUM",
    });
  }
  if (next.venue && prev.venue && next.venue !== prev.venue) {
    events.push({ kind: "venue", label: `Lieu : ${prev.venue} → ${next.venue}`, severity: "MEDIUM" });
  }

  const addedH = newAbsences(prev.absencesHome, next.absencesHome);
  const addedA = newAbsences(prev.absencesAway, next.absencesAway);
  for (const a of [...addedH, ...addedA]) {
    const star = a.role === "star";
    events.push({
      kind: a.reason === "suspension" ? "suspension" : "injury",
      label: `${a.player} indisponible (${a.reason === "suspension" ? "suspension" : "blessure"})`,
      severity: star ? "CRITICAL" : a.role === "starter" ? "HIGH" : "LOW",
    });
  }
  if (absKey(prev.absencesHome) !== absKey(next.absencesHome) || absKey(prev.absencesAway) !== absKey(next.absencesAway)) {
    if (!addedH.length && !addedA.length) {
      events.push({ kind: "injury", label: "Liste d'absences mise à jour", severity: "MEDIUM" });
    }
  }

  if (prev.formationHome !== next.formationHome || prev.formationAway !== next.formationAway) {
    events.push({
      kind: "lineup",
      label: `Schéma ${prev.formationHome}/${prev.formationAway} → ${next.formationHome}/${next.formationAway}`,
      severity: "MEDIUM",
    });
  }

  if ((prev.formHome ?? "") !== (next.formHome ?? "") || (prev.formAway ?? "") !== (next.formAway ?? "")) {
    events.push({ kind: "form", label: "Forme récente mise à jour", severity: "LOW" });
  }

  const move = oddsMove(prev, next);
  if (move >= 0.18) {
    events.push({ kind: "odds", label: "Mouvement de cotes important", severity: "HIGH" });
  } else if (move >= 0.08) {
    events.push({ kind: "odds", label: "Cotes en mouvement", severity: "MEDIUM" });
  } else if (move >= 0.03) {
    events.push({ kind: "odds", label: "Léger mouvement de cotes", severity: "LOW" });
  }

  const severity = maxSev(events);
  return {
    severity: events.length ? severity : "LOW",
    events,
    shouldRecalc: RANK[severity] >= RANK.HIGH || events.some((e) => e.kind === "injury" || e.kind === "suspension" || e.kind === "odds" || e.kind === "postponement"),
  };
}

export function reasonFrom(report: ChangeReport): string {
  if (!report.events.length) return "Première publication";
  return report.events
    .slice(0, 3)
    .map((e) => e.label)
    .join(" · ");
}
