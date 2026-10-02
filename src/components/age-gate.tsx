import { useEffect, useState } from "react";
import { isPreviewSurface } from "@/lib/preview-embed";

export const AGE_GATE_KEY = "betgpt-18";
export const AGE_GATE_ACCEPTED_EVENT = "betgpt-age-accepted";

export function AgeGate() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isPreviewSurface()) return;
    try {
      setOpen(localStorage.getItem(AGE_GATE_KEY) !== "1");
    } catch {
      /* stockage bloqué : ne pas verrouiller l'écran */
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  const accept = () => {
    try {
      localStorage.setItem(AGE_GATE_KEY, "1");
    } catch {
      /* la session courante reste déverrouillée même sans stockage */
    }
    window.dispatchEvent(new Event(AGE_GATE_ACCEPTED_EVENT));
    setOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex min-h-dvh items-center justify-center overflow-y-auto bg-slate-950 p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="betgpt-age-title"
      aria-describedby="betgpt-age-copy"
    >
      <div className="w-full max-w-md space-y-5 rounded-2xl border border-white/15 bg-white p-5 shadow-2xl sm:p-7">
        <div className="space-y-2">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-rust">Accès réservé aux majeurs</p>
          <h2 id="betgpt-age-title" className="text-2xl font-black tracking-tight text-paper">
            As-tu 18 ans ou plus ?
          </h2>
          <p id="betgpt-age-copy" className="text-sm leading-relaxed text-mist">
            BetGPT traite de paris sportifs et compare des cotes. Le site est réservé aux personnes majeures.
            Les jeux d’argent comportent des risques : endettement, isolement et dépendance.
          </p>
        </div>

        <button
          type="button"
          className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-sage px-5 text-base font-black text-ink shadow-sm active:translate-y-px"
          onClick={accept}
        >
          J’ai 18 ans ou plus — accéder au site
        </button>

        <a
          href="https://www.joueurs-info-service.fr"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-line px-4 text-sm font-semibold text-paper"
        >
          J’ai moins de 18 ans
        </a>

        <p className="text-center text-xs leading-relaxed text-muted">
          Joueurs Info Service · 09 74 75 13 13 · appel non surtaxé
        </p>
      </div>
    </div>
  );
}
