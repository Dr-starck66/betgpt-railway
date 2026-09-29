import { useState } from "react";

/** Real share actions only: copy or the browser share sheet. No automated clicks. */
export function SharePage({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }
  async function nativeShare() {
    if (!navigator.share) {
      await copy();
      return;
    }
    try {
      await navigator.share({ title, url });
    } catch {
      /* dismissed */
    }
  }
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => void copy()} className="min-h-11 rounded-md border border-line px-3 text-sm font-semibold text-paper">
        {copied ? "Lien copié" : "Copier le lien"}
      </button>
      <button type="button" onClick={() => void nativeShare()} className="min-h-11 rounded-md border border-line px-3 text-sm font-semibold text-paper">
        Partager
      </button>
    </div>
  );
}
