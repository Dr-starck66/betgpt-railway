"use client";

import { Maximize2, Share2, Trophy, X } from "lucide-react";
import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";
import { CHAT_DIPLOMAS, type ChatDiplomaId } from "@/lib/chat/diplomas";

export function ChatDiploma({ diplomaId }: { diplomaId: ChatDiplomaId }) {
  const diploma = CHAT_DIPLOMAS[diplomaId];
  const [shared, setShared] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    track("chat_diploma_award", diplomaId);
  }, [diplomaId]);

  useEffect(() => {
    if (!fullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [fullscreen]);

  const openFullscreen = () => {
    setFullscreen(true);
    track("chat_diploma_fullscreen_open", diplomaId);
  };

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
      <button
        type="button"
        onClick={openFullscreen}
        className="group relative block w-full bg-white text-left"
        aria-label={"Agrandir le diplôme " + diploma.title}
      >
        <img
          src={diploma.image}
          alt={"Diplôme BetGPT : " + diploma.title}
          loading="lazy"
          decoding="async"
          className="h-auto w-full"
        />
        <span className="absolute bottom-2 right-2 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-white/70 bg-black/70 px-3 text-[11px] font-black text-white shadow-lg backdrop-blur transition group-active:scale-95">
          <Maximize2 size={14} aria-hidden="true" />
          Plein écran
        </span>
      </button>
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

      {fullscreen ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/95 p-2 sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-label={"Diplôme BetGPT en plein écran : " + diploma.title}
          onClick={() => setFullscreen(false)}
        >
          <button
            type="button"
            onClick={() => setFullscreen(false)}
            className="fixed right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] z-[121] inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-black/65 text-white shadow-xl backdrop-blur"
            aria-label="Fermer le diplôme en plein écran"
          >
            <X size={24} />
          </button>

          <div
            className="flex h-full w-full items-center justify-center"
            onClick={(event) => event.stopPropagation()}
          >
            <img
              src={diploma.portraitImage}
              alt={"Diplôme BetGPT portrait : " + diploma.title}
              aria-label="Diplôme BetGPT portrait"
              decoding="async"
              className="h-[min(96dvh,calc(100vw*16/9))] w-auto max-w-[96vw] rounded-[1.75rem] object-contain shadow-2xl sm:max-h-[calc(100dvh-2.5rem)]"
            />
          </div>
        </div>
      ) : null}
    </figure>
  );
}
