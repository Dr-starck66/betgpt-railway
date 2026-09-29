import { useState } from "react";
import { Share2 } from "lucide-react";
import { SITE_URL } from "@/lib/programmatic";

export function ShareHunter({
  title,
  line,
  path,
}: {
  title: string;
  line: string;
  path: string;
}) {
  const [copied, setCopied] = useState(false);
  const url = `${SITE_URL}${path}`;
  const text = `${title}\n${line}\n${url}`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* */
    }
  }
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => void copy()}
        className="inline-flex min-h-11 items-center gap-2 rounded-md border border-line px-3 text-sm font-medium text-mist hover:text-paper"
      >
        <Share2 className="h-4 w-4" />
        {copied ? "Copié" : "Copier le lien"}
      </button>
      <a
        href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center rounded-md border border-line px-3 text-sm font-medium text-mist hover:text-paper"
      >
        Partager
      </a>
    </div>
  );
}
