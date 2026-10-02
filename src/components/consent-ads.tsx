import { useEffect, useState } from "react";
import { isPreviewSurface } from "@/lib/preview-embed";
import { AGE_GATE_ACCEPTED_EVENT, AGE_GATE_KEY } from "@/components/age-gate";

export const CONSENT_KEY = "betgpt-consent";
const OPEN = "betgpt-open-consent";

export function readConsent(): "ads" | "essential" | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    if (v === "ads" || v === "essential") return v;
  } catch {
    /* */
  }
  return null;
}

export function openCookieSettings() {
  window.dispatchEvent(new Event(OPEN));
}

export function ConsentAds() {
  const [choice, setChoice] = useState<"ads" | "essential" | null>(null);
  const [force, setForce] = useState(false);
  const [ready, setReady] = useState(false);
  const [ageAccepted, setAgeAccepted] = useState(false);
  const [pub, setPub] = useState("");

  useEffect(() => {
    if (isPreviewSurface()) {
      setChoice("essential");
      setAgeAccepted(true);
      setReady(true);
      return;
    }

    const syncAge = () => {
      try {
        setAgeAccepted(localStorage.getItem(AGE_GATE_KEY) === "1");
      } catch {
        setAgeAccepted(true);
      }
    };

    syncAge();
    setChoice(readConsent());
    setReady(true);

    const onOpen = () => setForce(true);
    window.addEventListener(OPEN, onOpen);
    window.addEventListener(AGE_GATE_ACCEPTED_EVENT, syncAge);
    return () => {
      window.removeEventListener(OPEN, onOpen);
      window.removeEventListener(AGE_GATE_ACCEPTED_EVENT, syncAge);
    };
  }, []);

  useEffect(() => {
    if (choice !== "ads") return;
    fetch("/api/legal", { credentials: "omit" })
      .then((r) => r.json())
      .then((l: { adsensePub?: string }) => setPub(l.adsensePub ?? ""))
      .catch(() => undefined);
  }, [choice]);

  useEffect(() => {
    if (choice !== "ads") return;
    const id = pub.startsWith("pub-") ? pub : "";
    if (!id) return;
    const src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-${id}`;
    if (document.querySelector(`script[src^="https://pagead2.googlesyndication.com"]`)) return;
    const s = document.createElement("script");
    s.async = true;
    s.crossOrigin = "anonymous";
    s.src = src;
    document.head.appendChild(s);
  }, [choice, pub]);

  function pick(next: "ads" | "essential") {
    try {
      localStorage.setItem(CONSENT_KEY, next);
    } catch {
      /* */
    }
    setChoice(next);
    setForce(false);
  }

  if (!ready || !ageAccepted) return null;
  if (choice && !force) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[70] border-t border-line bg-surface p-4 shadow-soft">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-paper">
          Cookies : essentiels (site, 18+). Publicité Google AdSense seulement si tu acceptes.{" "}
          <a href="/cookies" className="text-sage underline">
            Politique cookies
          </a>
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="min-h-11 rounded-md bg-sage px-4 text-sm font-semibold text-ink"
            onClick={() => pick("ads")}
          >
            Accepter
          </button>
          <button
            type="button"
            className="min-h-11 rounded-md border border-line px-4 text-sm font-semibold text-paper"
            onClick={() => pick("essential")}
          >
            Essentiels seulement
          </button>
        </div>
      </div>
    </div>
  );
}
