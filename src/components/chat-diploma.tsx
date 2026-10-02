"use client";

import { Share2, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";
import { CHAT_DIPLOMAS, type ChatDiplomaId } from "@/lib/chat/diplomas";

export function ChatDiploma({ diplomaId }: { diplomaId: ChatDiplomaId }) {
  const diploma = CHAT_DIPLOMAS[diplomaId];
  const [shared, setShared] = useState(false);

  useEffect(() => {
    track("chat_diploma_award", diplomaId);
  }, [diplomaId]);

  const share = async () => {
    const absolute = new URL(diploma.image, window.location.origin).toString();
    try {
      const response = await fetch(diploma.image);
      const blob = await response.blob();
      const file = new File([blob], "betgpt-" + diplomaId.toLowerCase() + ".svg", {
        type: blob.type || "image/svg+xml",
      });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: diploma.title + " — BetGPT",
          text: "Je viens de débloquer ce diplôme sur BetGPT 😭",
          url: window.location.href,
          files: [file],
        });
        track("chat_diploma_share", diplomaId);
        setShared(true);
        window.setTimeout(() => setShared(false), 1800);
        return;
      }
      if (navigator.share) {
        await navigator.share({
          title: diploma.title + " — BetGPT",
          text: "Je viens de débloquer ce diplôme sur BetGPT 😭",
          url: absolute,
        });
        track("chat_diploma_share", diplomaId);
        setShared(true);
        window.setTimeout(() => setShared(false), 1800);
        return;
      }
      await navigator.clipboard.writeText(absolute);
      setShared(true);
      track("chat_diploma_copy", diplomaId);
      window.setTimeout(() => setShared(false), 1800);
    } catch {
      // A cancelled share must never break the conversation.
    }
  };

  return (
    <figure className="mt-3 overflow-hidden rounded-2xl border border-amber-300/70 bg-amber-50/70 shadow-[0_14px_35px_rgba(120,78,18,0.14)]">
      <div className="flex items-center justify-between gap-2 border-b border-amber-200/80 bg-amber-100/80 px-3 py-2">
        <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-amber-900">
          <Trophy size={14} aria-hidden="true" />
          Diplôme débloqué
        </p>
        <span className="text-[10px] font-black uppercase tracking-[0.12em] text-amber-800/70">
          {diplomaId}
        </span>
      </div>
      <a href={diploma.image} target="_blank" rel="noopener noreferrer" className="block bg-white">
        <img
          src={diploma.image}
          alt={"Diplôme BetGPT : " + diploma.title}
          loading="lazy"
          decoding="async"
          className="h-auto w-full"
        />
      </a>
      <figcaption className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-black leading-tight text-paper">{diploma.title}</p>
          <p className="mt-0.5 text-[11px] font-semibold leading-relaxed text-muted">{diploma.unlock}</p>
        </div>
        <button
          type="button"
          onClick={() => void share()}
          className="inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-full border border-amber-300 bg-white px-3 text-xs font-black text-amber-950 hover:bg-amber-50"
          aria-label={"Partager le diplôme " + diploma.title}
        >
          <Share2 size={14} />
          {shared ? "Partagé ✓" : "Partager"}
        </button>
      </figcaption>
    </figure>
  );
}
