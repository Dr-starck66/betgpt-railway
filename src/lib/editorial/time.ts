import type { SlotId, SlotMetrics, TimeChange } from "@/lib/editorial/types";

export const DEFAULT_TIMES: Record<SlotId, string> = {
  morning: "08:00",
  noon: "13:00",
  evening: "19:00",
};

const SLOT_BOUNDS: Record<SlotId, [number, number]> = {
  morning: [6 * 60, 9 * 60 + 30],
  noon: [11 * 60, 14 * 60 + 30],
  evening: [17 * 60, 21 * 60],
};

export function parisParts(date: Date): { date: string; hour: number; minute: number } {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const bag: Record<string, string> = {};
  for (const part of fmt.formatToParts(date)) bag[part.type] = part.value;
  return {
    date: `${bag.year}-${bag.month}-${bag.day}`,
    hour: Number(bag.hour),
    minute: Number(bag.minute),
  };
}

export function parisDate(date: Date): string {
  return parisParts(date).date;
}

export function instantParisDate(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  return parisDate(new Date(ms));
}

/** Instant UTC corresponding to HH:mm on a calendar day in Europe/Paris. */
export function slotInstant(day: string, hhmm: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  if (!y || !m || !d || Number.isNaN(hh) || Number.isNaN(mm)) return new Date(NaN);
  let utc = Date.UTC(y, m - 1, d, hh, mm, 0);
  for (let i = 0; i < 4; i += 1) {
    const got = parisParts(new Date(utc));
    const gotMin = got.hour * 60 + got.minute;
    const want = hh * 60 + mm;
    let dayDelta = 0;
    if (got.date > day) dayDelta = -1;
    else if (got.date < day) dayDelta = 1;
    const delta = want - gotMin + dayDelta * 24 * 60;
    if (delta === 0) break;
    utc += delta * 60 * 1000;
  }
  return new Date(utc);
}

export function formatParis(iso: string | null): string {
  if (!iso) return "heure non publiée";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "heure non publiée";
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(ms));
}

export function dayLabel(day: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(slotInstant(day, "12:00"));
}

function clampShift(slot: SlotId, hhmm: string, shiftMin: number): string {
  const [hh, mm] = hhmm.split(":").map(Number);
  const [lo, hi] = SLOT_BOUNDS[slot];
  const rounded = Math.round(shiftMin / 5) * 5;
  const clamped = Math.max(-20, Math.min(20, rounded));
  let total = hh * 60 + mm + clamped;
  if (total < lo) total = lo;
  if (total > hi) total = hi;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Bouge un créneau seulement si une mesure réelle le demande.
 * Sans échantillon suffisant, l'heure reste celle demandée.
 */
export function optimizeTimes(
  current: Record<SlotId, string>,
  metrics: SlotMetrics | undefined,
  history: TimeChange[] = [],
): { times: Record<SlotId, string>; changes: TimeChange[] } {
  const times = { ...current };
  const changes = [...history];
  if (!metrics) return { times, changes };
  (Object.keys(DEFAULT_TIMES) as SlotId[]).forEach((slot) => {
    const metric = metrics[slot];
    if (!metric || metric.samples < 21 || metric.suggestedShiftMin == null) return;
    if (!Number.isFinite(metric.suggestedShiftMin) || metric.suggestedShiftMin === 0) return;
    const next = clampShift(slot, times[slot], metric.suggestedShiftMin);
    if (next === times[slot]) return;
    const already = changes.some((row) => row.slot === slot && row.newTime === next && row.oldTime === times[slot]);
    if (!already) {
      changes.push({
        slot,
        oldTime: times[slot],
        newTime: next,
        reason: "décalage demandé par les mesures du créneau",
        window: `n=${metric.samples}; ctr=${metric.ctr == null ? "UNKNOWN" : metric.ctr}`,
      });
    }
    times[slot] = next;
  });
  return { times, changes };
}
