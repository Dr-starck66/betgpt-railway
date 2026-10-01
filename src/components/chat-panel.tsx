"use client";

import { Send, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SeoImg } from "@/components/seo-img";
import { BRAND_LOGO } from "@/lib/image-seo";
import { cn } from "@/lib/utils";
import {
  EMPTY_MEMORY,
  normalizeMemory,
  parseMode,
  type ChatMessage,
  type PersonalityMode,
  type UserMemory,
} from "@/lib/chat/types";
import { track } from "@/lib/analytics";
import { postChat } from "@/lib/chat/transport";
import { playPunchline } from "@/lib/chat/voice";

const WELCOME: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Bienvenue sur BetGPT 👋\n\nParle-moi foot normalement : un match, un ticket, une cote, une intuition ou même une théorie complètement lunaire. Je te dirai ce qui tient debout — et ce qui mérite le carton rouge.",
  timestamp: 0,
};

const MODES: { id: PersonalityMode; label: string }[] = [
  { id: "NORMAL", label: "Normal" },
  { id: "ROAST", label: "Sans filtre" },
];

const ACTIONS: { label: string; text: string; mode?: PersonalityMode }[] = [
  { label: "Le ticket du jour", text: "Qu'est-ce que tu mises aujourd'hui, et pourquoi ?" },
  {
    label: "0-0 Hunter",
    text: "Quelles ligues ont le moins de 0-0, et quels matches du desk ont une faible proba de 0-0 ?",
  },
  { label: "2-1 ce soir", text: "Quels matches ce soir ressemblent statistiquement à un 2-1 ?" },
  {
    label: "BTTS",
    text: "Quels matches sont les plus forts pour BTTS selon le modèle et l'archive ?",
  },
  { label: "Démonte mon pari", text: "Démonte mon pari : ", mode: "ROAST" },
  { label: "Analyse un match", text: "Analyse le match le plus intéressant du jour." },
];

const MEMORY_KEY = "betgpt-chat-memory";
const LEGACY_MEMORY_KEY = "calibre-betgpt-memory";

const REACTION_LABEL: Record<string, string> = {
  ANIMAL_CHAOS: "zoo intersidéral",
  COSMIC_CHAOS: "orbite perdue",
  NUCLEAR_CHAOS: "réacteur en PLS",
  BETTING_DISASTER: "ticket carbonisé",
  ABSURD_SHOCK: "cerveau débranché",
};

function loadMemory(): UserMemory {
  try {
    const raw = localStorage.getItem(MEMORY_KEY) ?? localStorage.getItem(LEGACY_MEMORY_KEY);
    if (!raw) return EMPTY_MEMORY;
    const parsed = normalizeMemory(JSON.parse(raw));
    if (!localStorage.getItem(MEMORY_KEY) && localStorage.getItem(LEGACY_MEMORY_KEY)) {
      localStorage.setItem(MEMORY_KEY, raw);
    }
    return parsed;
  } catch {
    return EMPTY_MEMORY;
  }
}

function saveMemory(m: UserMemory) {
  try {
    localStorage.setItem(MEMORY_KEY, JSON.stringify(m));
  } catch {
    /* ignore */
  }
}

function touchMemory(prev: UserMemory, content: string, mode: PersonalityMode): UserMemory {
  const next: UserMemory = {
    ...prev,
    blackBook: { ...prev.blackBook },
    preferences: { ...prev.preferences },
  };
  const low = content.toLowerCase();
  if (low.includes("feeling") || low.includes("instinct") || low.includes("au feeling")) {
    next.blackBook.jaiUnFeeling += 1;
  }
  if ((low.includes("combiné") || low.includes("combine")) && /\b([5-9]|1\d)\b/.test(low)) {
    next.blackBook.combinésDePlus5Matchs += 1;
  }
  next.sarcasticIntensity = mode === "ROAST" ? 100 : 40;
  return next;
}

export function ChatPanel({ seed }: { seed?: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<PersonalityMode>("NORMAL");
  const [placeholder] = useState("Un match, un pari, un feeling…");
  const [memory, setMemory] = useState<UserMemory>(EMPTY_MEMORY);
  const scrollRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const seeded = useRef(false);
  const sending = useRef(false);

  useEffect(() => {
    setMemory(loadMemory());
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = async (text?: string, nextMode: PersonalityMode = mode) => {
    const content = (text ?? boxRef.current?.value ?? "").trim();
    if (!content || sending.current) return;
    if (content.length > 4000) {
      setError("Ton message dépasse 4 000 caractères.");
      return;
    }
    setError(null);
    sending.current = true;
    const resolved = parseMode(nextMode);
    const mem = touchMemory(memory, content, resolved);
    setMemory(mem);
    saveMemory(mem);
    setMode(resolved);

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content,
      timestamp: Date.now(),
    };
    const assistantId = `a-${Date.now()}`;
    const history = [...messages, userMsg];
    setMessages([
      ...history,
      { id: assistantId, role: "assistant", content: "", timestamp: Date.now() },
    ]);
    if (boxRef.current) {
      boxRef.current.value = "";
      boxRef.current.style.height = "auto";
    }
    setBusy(true);
    track("chat_ask");

    try {
      const payload = history
        .filter((m) => m.id !== "welcome")
        .map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
        }));
      const out = await postChat({
        messages: payload,
        userMemory: mem,
        requestedMode: resolved,
      });
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: out.text, punchline: out.punchline } : m,
        ),
      );
      if (out.punchline) void playPunchline(out.punchline);
    } catch (err) {
      const msg =
        err instanceof Error && err.name === "AbortError"
          ? "Trop long. Réessaie."
          : err instanceof Error
            ? err.message
            : "Connexion coupée. Réessaie.";
      setError(msg);
      setMessages((prev) => prev.filter((m) => m.id !== assistantId && m.id !== userMsg.id));
      if (boxRef.current) boxRef.current.value = content;
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!seed || seeded.current) return;
    seeded.current = true;
    if (boxRef.current) boxRef.current.value = seed;
  }, [seed]);

  return (
    <div className="chat-panel flex min-w-0 flex-col overflow-hidden rounded-[1.35rem] border border-line bg-white shadow-soft">
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2.5">
          <SeoImg
            seo={{ ...BRAND_LOGO, width: 28, height: 28 }}
            priority
            width={28}
            height={28}
            className="h-8 w-8 rounded-xl border border-line object-cover shadow-sm"
          />
          <div>
            <p className="text-sm font-semibold tracking-tight text-paper">BetGPT</p>
            <p className="text-xs text-muted">Foot, données, paris et vraie conversation</p>
          </div>
        </div>
        <span className="shrink-0 text-xs text-muted" role="status">
          {busy ? "Recherche…" : "À toi"}
        </span>
      </header>

      <div
        ref={scrollRef}
        role="log"
        aria-label="Conversation"
        aria-live="polite"
        aria-busy={busy}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-5 sm:px-5"
      >
        {messages.map((msg, i) => {
          const mine = msg.role === "user";
          const streaming = busy && i === messages.length - 1 && !mine;
          if (!msg.content && !streaming) return null;
          return (
            <div key={msg.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "min-w-0 max-w-[95%] break-words rounded-2xl px-4 py-3 text-base leading-relaxed whitespace-pre-wrap sm:max-w-[80%]",
                  mine ? "bg-sage text-ink shadow-sm" : "border border-line bg-slate-50 text-paper",
                )}
              >
                {!mine && (
                  <p className="mb-1 text-[10px] uppercase tracking-[0.18em] text-muted">BetGPT</p>
                )}
                {msg.content || (streaming ? "…" : "")}
                {!mine && msg.punchline?.reaction && !streaming ? (
                  <div
                    className="mt-3 overflow-hidden rounded-2xl border border-line bg-white/80 p-2"
                    aria-label="Réaction visuelle BetGPT"
                  >
                    <div className="mb-2 text-2xl leading-none" aria-hidden="true">
                      {msg.punchline.reaction.emojis.join(" ")}
                    </div>
                    {msg.punchline.score >= 92 ? (
                      <div
                        className="flex min-h-24 w-full max-w-[320px] items-center justify-center overflow-hidden rounded-xl border border-line bg-slate-950 px-4 text-center"
                        role="img"
                        aria-label={`Réaction BetGPT : ${REACTION_LABEL[msg.punchline.reaction.mood] ?? "chaos"}`}
                      >
                        <span className="animate-bounce text-4xl" aria-hidden="true">
                          {msg.punchline.reaction.emojis.join(" ")}
                        </span>
                        <span className="ml-3 text-xs font-black uppercase tracking-[0.18em] text-white">
                          {REACTION_LABEL[msg.punchline.reaction.mood] ?? "chaos"}
                        </span>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {!mine && msg.punchline && !streaming ? (
                  <button
                    type="button"
                    onClick={() => void playPunchline(msg.punchline!)}
                    className="mt-2 flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-white px-3 text-xs font-semibold text-paper hover:border-sage/50"
                    aria-label="Rejouer la punchline"
                    title="Rejouer la punchline"
                  >
                    <Volume2 size={14} />
                    Rejouer le cri
                  </button>
                ) : null}
                {streaming && (
                  <span className="ml-1 inline-block h-3 w-1.5 animate-pulse bg-sage align-middle" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="shrink-0 border-t border-line p-3 sm:px-5">
        {error ? (
          <p role="alert" className="mb-2 text-sm text-rust">
            {error} Ton message est conservé ci-dessous.
          </p>
        ) : null}
        <div className="mb-2 flex gap-2 overflow-x-auto">
          {ACTIONS.map((a) => (
            <button
              key={a.label}
              type="button"
              disabled={busy}
              onClick={() => {
                if (a.mode) setMode(a.mode);
                if (a.text.endsWith(": ")) {
                  if (boxRef.current) {
                    boxRef.current.value = a.text;
                    boxRef.current.focus();
                  }
                } else {
                  void send(a.text, a.mode ?? mode);
                }
              }}
              className="min-h-10 shrink-0 rounded-full border border-line bg-white px-3 text-xs font-medium text-mist hover:border-sage/40 hover:text-paper disabled:opacity-40"
            >
              {a.label}
            </button>
          ))}
        </div>
        <div className="mb-2 flex gap-1">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={mode === m.id}
              onClick={() => setMode(m.id)}
              className={cn(
                "min-h-10 rounded-full px-4 text-sm font-semibold",
                mode === m.id
                  ? "bg-sage text-ink shadow-sm"
                  : "border border-line bg-white text-muted hover:text-paper",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            void send(String(fd.get("message") ?? boxRef.current?.value ?? ""), mode);
          }}
          className="flex items-end gap-2"
        >
          <textarea
            ref={boxRef}
            name="message"
            aria-label="Ton message à BetGPT"
            maxLength={4000}
            disabled={busy}
            rows={1}
            autoComplete="off"
            placeholder={placeholder}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send(e.currentTarget.value, mode);
              }
            }}
            className="min-h-12 min-w-0 flex-1 resize-none rounded-2xl border border-line bg-white py-3 px-4 text-base text-paper shadow-sm placeholder:text-muted focus:border-sage focus:outline-none"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void send(boxRef.current?.value, mode)}
            className="inline-flex h-12 min-w-12 shrink-0 items-center justify-center gap-1.5 rounded-full bg-sage px-4 text-sm font-semibold text-ink shadow-[0_8px_18px_rgba(124,194,58,0.22)] disabled:opacity-40"
            aria-label="Envoyer"
          >
            <Send size={16} />
            <span className="hidden sm:inline">Envoyer</span>
          </button>
        </form>
      </div>
    </div>
  );
}
