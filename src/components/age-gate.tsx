import { useEffect, useState } from "react";
import { isPreviewSurface } from "@/lib/preview-embed";

const KEY = "betgpt-18";

export function AgeGate() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (isPreviewSurface()) return;
    try {
      setOpen(localStorage.getItem(KEY) !== "1");
    } catch {
      /* cookies bloqués : ne pas verrouiller l'écran */
    }
  }, []);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/50 p-6">
      <div className="max-w-md space-y-4 rounded-lg border border-line bg-surface p-6 shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-wider text-sage">Interdit aux mineurs</p>
        <h2 className="text-xl font-semibold text-paper">As-tu 18 ans ou plus ?</h2>
        <p className="text-sm text-mist">
          BetGPT compare des cotes de paris sportifs. Accès réservé aux majeurs. Jouer comporte des
          risques : endettement, isolement, dépendance.{" "}
          <a href="https://www.joueurs-info-service.fr" className="text-sage underline">
            Joueurs Info Service
          </a>{" "}
          09 74 75 13 13.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="min-h-11 rounded-md bg-sage px-4 text-sm font-semibold text-ink"
            onClick={() => {
              try {
                localStorage.setItem(KEY, "1");
              } catch {
                /* */
              }
              setOpen(false);
            }}
          >
            J’ai 18 ans ou plus
          </button>
          <a href="https://www.joueurs-info-service.fr" className="inline-flex min-h-11 items-center px-4 text-sm text-mist">
            J’ai moins de 18 ans
          </a>
        </div>
      </div>
    </div>
  );
}
