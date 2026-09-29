import { useEffect, useRef, useState } from "react";
import { readConsent } from "@/components/consent-ads";
import { track } from "@/lib/analytics";
import { isPreviewSurface } from "@/lib/preview-embed";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export function AdSlot({ slot }: { slot: string }) {
  const [pub, setPub] = useState("");
  const seen = useRef(false);

  useEffect(() => {
    if (isPreviewSurface()) return;
    if (readConsent() !== "ads") return;
    fetch("/api/legal", { credentials: "omit" })
      .then((r) => r.json())
      .then((l: { adsensePub?: string }) => {
        const p = (l.adsensePub ?? "").replace(/^ca-/, "");
        if (p.startsWith("pub-")) setPub(p);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!pub || seen.current) return;
    seen.current = true;
    track("ad_impression", slot);
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* script not loaded */
    }
  }, [pub, slot]);

  if (!pub) return null;
  return (
    <aside data-ad-slot={slot} aria-label="Publicité" className="min-h-[90px] overflow-hidden">
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={`ca-${pub}`}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
