import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { logAffiliateClick } from "@/lib/desk.functions";

export const Route = createFileRoute("/go")({
  validateSearch: (s: Record<string, unknown>) => ({
    u: String(s.u ?? ""),
    b: String(s.b ?? ""),
    m: String(s.m ?? ""),
  }),
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, nofollow" },
      { name: "googlebot", content: "noindex, nofollow" },
    ],
  }),
  component: Go,
});

function Go() {
  const { u, b, m } = Route.useSearch();
  useEffect(() => {
    let cancelled = false;
    void logAffiliateClick({ data: { url: u, book: b, matchId: m } }).then((res) => {
      if (cancelled) return;
      const dest = res.ok ? res.url : "/";
      window.location.replace(dest);
    });
    return () => {
      cancelled = true;
    };
  }, [u, b, m]);
  return <p className="px-6 py-16 text-sm text-mist">Ouverture du site de paris…</p>;
}
