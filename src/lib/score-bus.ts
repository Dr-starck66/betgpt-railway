import { useEffect, useState } from "react";

export type ScoreTick = {
  id: string;
  h: number;
  a: number;
  clock?: string;
  status?: string;
};

const map = new Map<string, ScoreTick>();
const subs = new Set<() => void>();
let timer: number | null = null;
let inflight = false;
let loadRef: (() => Promise<ScoreTick[]>) | null = null;

function sameTick(a: ScoreTick | undefined, b: ScoreTick): boolean {
  return Boolean(
    a && a.h === b.h && a.a === b.a && a.clock === b.clock && a.status === b.status,
  );
}

function emit() {
  for (const fn of subs) fn();
}

export function applyTicks(ticks: ScoreTick[]) {
  let changed = false;
  for (const t of ticks) {
    if (sameTick(map.get(t.id), t)) continue;
    map.set(t.id, t);
    changed = true;
  }
  if (changed) emit();
}

export function useScoreTick(id: string, fallback: ScoreTick): ScoreTick {
  const [tick, setTick] = useState<ScoreTick>(() => map.get(id) ?? fallback);
  useEffect(() => {
    const sync = () => {
      const next = map.get(id) ?? fallback;
      setTick((cur) => (sameTick(cur, next) ? cur : next));
    };
    sync();
    subs.add(sync);
    return () => {
      subs.delete(sync);
    };
  }, [id, fallback.h, fallback.a, fallback.clock, fallback.status]);
  return tick;
}

/** One poll for the whole app. Scores only — never a router reload. */
export function startScorePoll(load: () => Promise<ScoreTick[]>, ms = 30000) {
  if (typeof window === "undefined") return;
  loadRef = load;
  if (timer != null) return;
  const tick = () => {
    if (document.hidden || inflight || !loadRef) return;
    inflight = true;
    void loadRef()
      .then((rows) => applyTicks(rows))
      .catch(() => undefined)
      .finally(() => {
        inflight = false;
      });
  };
  timer = window.setInterval(tick, ms);
}