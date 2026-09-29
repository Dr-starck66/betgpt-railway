import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getLiveTick } from "@/lib/desk.functions";
import { startScorePoll } from "@/lib/score-bus";

/** Scores only. Never invalidate the router — that was blanking the preview. */
export function useLiveRefresh(active: boolean): void {
  const load = useServerFn(getLiveTick);
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    if (!active) return;
    startScorePoll(() => loadRef.current());
  }, [active]);
}