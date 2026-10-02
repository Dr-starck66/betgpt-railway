"use client";

import { Check, Copy, Send, Share2, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
import { reactionForPunchline, type PunchReaction } from "@/lib/chat/reaction";
import { ChatDiploma } from "@/components/chat-diploma";
import { selectChatDiploma, type ChatDiplomaId } from "@/lib/chat/diplomas";
import {
  buildFacebookShareUrl,
  buildShareMoment,
  buildXShareUrl,
  drawShareCard,
} from "@/lib/chat/share";

const WELCOME: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Bienvenue sur BetGPT 👋\n\nBalance un match, un ticket, une cote ou ton fameux « feeling ». Je m’occupe des probabilités ; toi, essaie simplement de ne pas confier ta bankroll à une boussole sous caféine. 😏 Si ton raisonnement tient debout, je le dirai. Sinon, il prendra le carton rouge avec une précision presque insultante.",
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
const MASCOT_STATIC = "/betgpt-mascot-avatar.webp";
const MASCOT_TALKING = "/betgpt-mascot-talking.gif";

const REACTION_LABEL: Record<string, string> = {
  ANIMAL_CHAOS: "zoo intersidéral",
  COSMIC_CHAOS: "orbite perdue",
  NUCLEAR_CHAOS: "réacteur en PLS",
  BETTING_DISASTER: "ticket carbonisé",
  SHOPPING_DISASTER: "CB en apesanteur",
  DIY_DISASTER: "caddie sans frein",
  ABSURD_SHOCK: "cerveau débranché",
};

type GifReaction = { url?: string; alt: string; provider?: string; scene?: string };

const LOCAL_REACTION_GIFS: Record<PunchReaction["mood"], string> = {
  ANIMAL_CHAOS: "/reactions/astra-animal.gif",
  COSMIC_CHAOS: "/reactions/astra-shock.gif",
  NUCLEAR_CHAOS: "/reactions/astra-shock.gif",
  BETTING_DISASTER: "/reactions/astra-betting.gif",
  SHOPPING_DISASTER: "/reactions/astra-betting.gif",
  DIY_DISASTER: "/reactions/astra-betting.gif",
  ABSURD_SHOCK: "/reactions/astra-fallback.gif",
};

function localGifForReaction(reaction: PunchReaction): GifReaction {
  return {
    url: LOCAL_REACTION_GIFS[reaction.mood],
    alt: `Réaction GIF BetGPT — ${REACTION_LABEL[reaction.mood] ?? "chaos"}`,
    provider: "local",
    scene: reaction.mood,
  };
}


function RichMessageText({ content }: { content: string }) {
  const parts = content.split(/(https?:\/\/[^\s]+)/g);
  return (
    <>
      {parts.map((part, index) =>
        /^https?:\/\//.test(part) ? (
          <a
            key={`url-${index}`}
            href={part}
            target="_blank"
            rel="nofollow sponsored noopener noreferrer"
            className="font-semibold text-sage underline decoration-sage/40 underline-offset-2 hover:decoration-sage"
          >
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </>
  );
}

function NativeReaction({ reaction, punchline }: { reaction: PunchReaction; punchline?: string }) {
  const icons = reaction.emojis.length ? reaction.emojis.slice(0, 3) : ["🤯", "😂", "💀"];
  const label = REACTION_LABEL[reaction.mood] ?? "chaos";
  const sceneCopy: Record<string, { kicker: string; headline: string }> = {
    ANIMAL_CHAOS: { kicker: "ALERTE ZOO", headline: "Quelqu’un a encore donné les clés au règne animal." },
    COSMIC_CHAOS: { kicker: "HOUSTON ?", headline: "Le raisonnement vient de quitter l’atmosphère." },
    NUCLEAR_CHAOS: { kicker: "NIVEAU RÉACTEUR", headline: "Ça vient de passer de douteux à radioactif." },
    BETTING_DISASTER: { kicker: "TICKET EN PLS", headline: "La bankroll demande un avocat." },
    SHOPPING_DISASTER: { kicker: "CARTE BLEUE", headline: "Le plafond vient de demander l’asile politique." },
    DIY_DISASTER: { kicker: "BRICOLAGE FINANCIER", headline: "Même la perceuse refuse de signer ce ticket." },
    ABSURD_SHOCK: { kicker: "MAIS QUOI ?", headline: "Le bon sens vient de déposer sa démission." },
  };
  const copy = sceneCopy[reaction.mood] ?? sceneCopy.ABSURD_SHOCK;
  return (
    <div
      className="relative mt-3 min-h-48 overflow-hidden rounded-2xl border border-line bg-paper px-4 py-5 text-white shadow-lg"
      aria-label={`Réaction animée BetGPT — ${label}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_15%,rgba(124,194,58,0.35),transparent_28%),radial-gradient(circle_at_82%_80%,rgba(255,255,255,0.12),transparent_32%)]" />
      <div className="relative flex items-start justify-between gap-3">
        <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em]">
          {copy.kicker}
        </span>
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/60">{label}</span>
      </div>
      <div className="relative my-4 flex min-h-20 items-center justify-center gap-2 overflow-hidden">
        {icons.map((icon, index) => (
          <span
            key={`${icon}-${index}`}
            aria-hidden="true"
            className={cn(
              "select-none text-6xl drop-shadow-xl sm:text-7xl",
              index === 0
                ? "animate-[bounce_0.75s_ease-in-out_infinite]"
                : index === 1
                  ? "animate-[pulse_0.9s_ease-in-out_infinite]"
                  : "animate-[spin_1.8s_linear_infinite]",
            )}
            style={{ animationDelay: `${index * 110}ms` }}
          >
            {icon}
          </span>
        ))}
      </div>
      <p className="relative text-center text-lg font-black leading-tight tracking-tight sm:text-xl">
        {copy.headline}
      </p>
      {punchline ? (
        <p className="relative mx-auto mt-2 max-w-xl text-center text-xs font-semibold leading-relaxed text-white/65">
          {punchline.slice(0, 150)}
        </p>
      ) : null}
    </div>
  );
}

function PunchReactionCard({ reaction, punchline }: { reaction: PunchReaction; punchline?: string }) {
  const label = REACTION_LABEL[reaction.mood] ?? "chaos";
  const [gif, setGif] = useState<GifReaction>(() => localGifForReaction(reaction));

  useEffect(() => {
    const local = localGifForReaction(reaction);
    setGif(local);

    const query = reaction.gifQuery.trim();
    if (!query) return;

    const controller = new AbortController();
    let active = true;

    void fetch("/api/punch-gif", {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query }),
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as GifReaction;
      })
      .then((value) => {
        if (!active || !value?.url) return;
        setGif(value);
      })
      .catch(() => {
        // Local GIF is already visible before the API request completes.
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [reaction.gifQuery, reaction.mood]);

  if (!gif.url) {
    return <NativeReaction reaction={reaction} punchline={punchline} />;
  }

  return (
    <figure
      className="mt-3 overflow-hidden rounded-2xl border border-line bg-white/80 p-2"
      aria-label="Réaction GIF BetGPT"
    >
      <div className="mb-2 flex items-center justify-between gap-2 rounded-xl bg-paper px-3 py-2 text-white">
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/65">{label}</span>
        <span
          className="select-none text-3xl leading-none drop-shadow-sm"
          aria-label="Émoticônes de réaction BetGPT"
        >
          {(reaction.emojis.length ? reaction.emojis : ["🤯", "😂", "💀"]).join(" ")}
        </span>
      </div>
      <img
        src={gif.url}
        alt={gif.alt}
        loading="eager"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => {
          const local = localGifForReaction(reaction);
          if (gif.url !== local.url) setGif(local);
          else setGif({ alt: local.alt, provider: "native" });
        }}
        className="max-h-64 w-full max-w-[22rem] rounded-xl border border-line object-contain"
      />
      <figcaption className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-muted">
          {gif.provider === "tenor" ? "GIF contextuel" : "GIF BetGPT intégré"}
        </span>
        <span className="text-[10px] font-semibold text-muted">GIF + emojis toujours actifs</span>
      </figcaption>
    </figure>
  );
}

function ShareMomentButton({
  prompt,
  punchline,
}: {
  prompt: string;
  punchline: string;
}) {
  const [status, setStatus] = useState<"idle" | "copied" | "image">("idle");

  const getMoment = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://betgpt.live";
    return buildShareMoment(origin, prompt, punchline);
  };

  const resetStatus = () => window.setTimeout(() => setStatus("idle"), 1800);

  const shareNative = async () => {
    const moment = getMoment();
    try {
      const canvas = drawShareCard(prompt, punchline, moment.url);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", 0.95));
      if (blob && typeof File !== "undefined") {
        const file = new File([blob], "betgpt-roast.png", { type: "image/png" });
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          await navigator.share({ title: moment.title, text: moment.text, url: moment.url, files: [file] });
          track("chat_share_image");
          return;
        }
      }
      if (navigator.share) {
        await navigator.share(moment);
        track("chat_share");
        return;
      }
      await navigator.clipboard.writeText(`${moment.text}\n${moment.url}`);
      setStatus("copied");
      track("chat_share_copy");
      resetStatus();
    } catch {
      /* User cancellation or unavailable share target: keep the chat intact. */
    }
  };

  const shareX = () => {
    window.open(buildXShareUrl(getMoment()), "_blank", "noopener,noreferrer");
    track("chat_share_x");
  };

  const shareFacebook = () => {
    window.open(buildFacebookShareUrl(getMoment()), "_blank", "noopener,noreferrer");
    track("chat_share_facebook");
  };

  const shareImage = async () => {
    const moment = getMoment();
    const canvas = drawShareCard(prompt, punchline, moment.url);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", 0.95));
    if (!blob) return;

    const file = typeof File !== "undefined"
      ? new File([blob], "betgpt-roast.png", { type: "image/png" })
      : null;

    try {
      if (file && navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: moment.title,
          text: moment.text,
          url: moment.url,
          files: [file],
        });
        track("chat_share_instagram");
        return;
      }
    } catch {
      /* Fall back to image export below. */
    }

    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = "betgpt-roast.png";
    a.click();
    URL.revokeObjectURL(href);
    setStatus("image");
    track("chat_share_image_export");
    resetStatus();
  };

  const nativeShareAvailable = typeof navigator !== "undefined" && typeof navigator.share === "function";

  useEffect(() => {
    track("chat_share_offer");
  }, []);

  return (
    <div
      className="mt-3 overflow-hidden rounded-2xl border border-sage/35 bg-[linear-gradient(135deg,rgba(124,194,58,0.12),rgba(255,255,255,0.96))] p-3 shadow-sm"
      aria-label="Défier un ami avec ce moment BetGPT"
    >
      <div className="flex flex-col gap-1">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sage">🔥 Moment à partager</p>
        <p className="text-sm font-black leading-tight text-paper">Tu crois qu’un pote peut faire pire ? Envoie-lui exactement ce défi.</p>
        <p className="text-[11px] leading-relaxed text-muted">Le lien rouvre la question en mode Sans filtre et mesure le réseau qui ramène le challenger.</p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => void shareNative()}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-sage px-4 text-xs font-black text-ink shadow-sm hover:brightness-95"
          title="Défier un pote en mode Sans filtre"
        >
          {status === "copied" ? <Check size={14} /> : nativeShareAvailable ? <Share2 size={14} /> : <Copy size={14} />}
          {status === "copied" ? "Défi copié ✓" : "Défie un pote"}
        </button>
        <button
          type="button"
          onClick={shareX}
          className="inline-flex min-h-9 items-center rounded-full border border-line bg-white px-3 text-xs font-black text-paper hover:border-sage/50"
          aria-label="Partager le défi sur X"
          title="Partager le défi sur X"
        >
          X
        </button>
        <button
          type="button"
          onClick={shareFacebook}
          className="inline-flex min-h-9 items-center rounded-full border border-line bg-white px-3 text-xs font-black text-paper hover:border-sage/50"
          aria-label="Partager le défi sur Facebook"
          title="Partager le défi sur Facebook"
        >
          Facebook
        </button>
        <button
          type="button"
          onClick={() => void shareImage()}
          className="inline-flex min-h-9 items-center rounded-full border border-line bg-white px-3 text-xs font-black text-paper hover:border-sage/50"
          aria-label="Créer la carte Instagram ou Story"
          title="Créer la carte Instagram ou Story"
        >
          {status === "image" ? "Carte prête ✓" : "Instagram / Story"}
        </button>
      </div>
    </div>
  );
}

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
  if (/\b(finalement|je change|j'ai changé|j’ai changé|derni[eè]re seconde|derni[eè]re minute)\b/i.test(content)) {
    next.blackBook.parisModifiésDerniereSeconde += 1;
  }
  if (/\b(impossible [àa] perdre|100\s*%|s[uû]r(?:e)? [àa] 100)\b/i.test(content)) {
    next.blackBook.matchsImpossiblesAPerdre += 1;
    next.blackBook.niveauDeConfianceInjustifie += 1;
  }
  if (/\b(j'ai perdu|j’ai perdu|on a perdu|pari perdu|ticket perdu)\b/i.test(content)) {
    next.blackBook.matchsEffectivementPerdus += 1;
  }
  if (/\b(all[- ]?in|je mets tout|je mise tout|tapis)\b/i.test(content)) {
    next.blackBook.niveauDeConfianceInjustifie += 1;
  }
  next.sarcasticIntensity = mode === "ROAST" ? 100 : 40;
  return next;
}

export function ChatPanel({
  seed,
  initialMode = "NORMAL",
  shareSource,
}: {
  seed?: string;
  initialMode?: PersonalityMode;
  shareSource?: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<PersonalityMode>(parseMode(initialMode));
  const [placeholder] = useState("Un match, un pari, un feeling…");
  const [memory, setMemory] = useState<UserMemory>(EMPTY_MEMORY);
  const [challengeAccepted, setChallengeAccepted] = useState(false);
  const [diplomas, setDiplomas] = useState<Record<string, ChatDiplomaId>>({});
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const seeded = useRef(false);
  const sending = useRef(false);
  const lastDiplomaRef = useRef<ChatDiplomaId | undefined>(undefined);
  const speakingTimer = useRef<number | null>(null);

  useEffect(() => {
    setMemory(loadMemory());
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    return () => {
      if (speakingTimer.current) window.clearTimeout(speakingTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!shareSource) return;
    track("chat_share_return", shareSource);
    if (seed) track("chat_challenge_view", shareSource);
  }, [seed, shareSource]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const markSpeaking = (messageId: string, answer: string) => {
    if (speakingTimer.current) window.clearTimeout(speakingTimer.current);
    const duration = Math.min(5200, Math.max(1600, Math.round(answer.length * 10)));
    setSpeakingMessageId(messageId);
    speakingTimer.current = window.setTimeout(() => {
      setSpeakingMessageId((current) => (current === messageId ? null : current));
      speakingTimer.current = null;
    }, duration);
  };

  const send = async (text?: string, nextMode: PersonalityMode = mode) => {
    const content = (text ?? boxRef.current?.value ?? "").trim();
    if (!content || sending.current) return;
    if (content.length > 4000) {
      setError("Ton message dépasse 4 000 caractères.");
      return;
    }
    setError(null);
    sending.current = true;
    if (shareSource && seed && !challengeAccepted) {
      setChallengeAccepted(true);
      track("chat_challenge_accept", shareSource);
    }
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
      markSpeaking(assistantId, out.text);
      const visualReaction =
        resolved === "ROAST"
          ? reactionForPunchline(out.punchline?.text ?? out.text, content)
          : out.punchline?.reaction;
      const awardedDiploma = selectChatDiploma({
        userText: content,
        assistantText: out.text,
        punchline: out.punchline?.text,
        memory: mem,
        mode: resolved,
        avoid: lastDiplomaRef.current,
      });
      if (awardedDiploma) {
        lastDiplomaRef.current = awardedDiploma;
        setDiplomas((prev) => ({ ...prev, [assistantId]: awardedDiploma }));
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: out.text, punchline: out.punchline, reaction: visualReaction }
            : m,
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
      if (speakingTimer.current) {
        window.clearTimeout(speakingTimer.current);
        speakingTimer.current = null;
      }
      setSpeakingMessageId(null);
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
          <div className="relative shrink-0">
            <div className="absolute -inset-1 rounded-2xl bg-sage/20 blur-md" aria-hidden="true" />
            <img
              src={!reduceMotion && (busy || speakingMessageId) ? MASCOT_TALKING : MASCOT_STATIC}
              alt="Mascotte BetGPT, assistant football sans filtre"
              width={48}
              height={48}
              loading="eager"
              decoding="async"
              className="relative h-12 w-12 rounded-2xl border border-sage/35 object-cover shadow-sm"
            />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight text-paper">BetGPT</p>
            <p className="text-xs text-muted">Foot, données, paris et vraie conversation</p>
          </div>
        </div>
        <span className="shrink-0 text-xs text-muted" role="status">
          {busy ? "BetGPT réfléchit…" : speakingMessageId ? "BetGPT te répond…" : "À toi"}
        </span>
      </header>

      {shareSource && seed && !challengeAccepted ? (
        <section className="mx-3 mt-3 overflow-hidden rounded-2xl border border-sage/40 bg-[linear-gradient(135deg,rgba(124,194,58,0.18),rgba(15,23,42,0.04))] p-4 sm:mx-5" aria-label="Défi BetGPT reçu">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-sage">🔥 Défi reçu</p>
            <span className="rounded-full border border-sage/30 bg-white/75 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-paper">
              Sans filtre activé
            </span>
          </div>
          <p className="mt-2 text-lg font-black tracking-tight text-paper">Un pote t’a envoyé ça. Tu assumes ? 😈</p>
          <blockquote className="mt-3 rounded-xl border border-line bg-white/85 px-3 py-2.5 text-sm font-semibold leading-relaxed text-paper">
            « {seed.slice(0, 260)} »
          </blockquote>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void send(seed, "ROAST")}
              className="inline-flex min-h-11 items-center rounded-full bg-sage px-5 text-sm font-black text-ink shadow-[0_8px_18px_rgba(124,194,58,0.22)] hover:brightness-95 disabled:opacity-40"
            >
              Accepte le défi
            </button>
            <span className="text-xs font-semibold text-muted">
              BetGPT répond, puis ton résultat devient repartageable.
            </span>
          </div>
        </section>
      ) : null}

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
          const speaking = !mine && !reduceMotion && (streaming || speakingMessageId === msg.id);
          if (!msg.content && !streaming) return null;
          return (
            <div key={msg.id} className={cn("flex items-end gap-2", mine ? "justify-end" : "justify-start")}>
              {!mine ? (
                <div
                  className={cn(
                    "relative mb-0.5 h-10 w-10 shrink-0 overflow-visible rounded-xl",
                    speaking && "ring-2 ring-sage/25 ring-offset-1 ring-offset-white",
                  )}
                  aria-hidden="true"
                >
                  <span
                    className={cn(
                      "pointer-events-none absolute -inset-1 rounded-2xl bg-sage/25 blur-md transition-opacity",
                      speaking ? "animate-pulse opacity-100" : "opacity-0",
                    )}
                  />
                  <img
                    src={speaking ? MASCOT_TALKING : MASCOT_STATIC}
                    alt=""
                    width={40}
                    height={40}
                    loading="eager"
                    decoding="async"
                    className={cn(
                      "relative h-10 w-10 rounded-xl border border-sage/30 object-cover shadow-sm transition-transform",
                      speaking && "scale-105",
                    )}
                  />
                  {streaming ? (
                    <span className="absolute -bottom-1 -right-1 flex h-4 min-w-4 items-center justify-center gap-[2px] rounded-full border border-white bg-paper px-1 shadow-sm">
                      <i className="h-1 w-1 animate-[bounce_0.55s_ease-in-out_infinite] rounded-full bg-sage" />
                      <i className="h-1 w-1 animate-[bounce_0.55s_ease-in-out_0.12s_infinite] rounded-full bg-sage" />
                      <i className="h-1 w-1 animate-[bounce_0.55s_ease-in-out_0.24s_infinite] rounded-full bg-sage" />
                    </span>
                  ) : null}
                </div>
              ) : null}
              <div
                className={cn(
                  "min-w-0 max-w-[95%] break-words rounded-2xl px-4 py-3 text-base leading-relaxed whitespace-pre-wrap sm:max-w-[80%]",
                  mine ? "bg-sage text-ink shadow-sm" : "border border-line bg-slate-50 text-paper",
                )}
              >
                {!mine && (
                  <p className="mb-1 text-[10px] uppercase tracking-[0.18em] text-muted">BetGPT</p>
                )}
                {msg.content ? <RichMessageText content={msg.content} /> : streaming ? "…" : ""}
                {!mine && msg.reaction && !streaming ? (
                  <PunchReactionCard reaction={msg.reaction} punchline={msg.punchline?.text} />
                ) : null}
                {!mine && !streaming && diplomas[msg.id] ? (
                  <ChatDiploma diplomaId={diplomas[msg.id]} />
                ) : null}
                {!mine && msg.punchline && !streaming ? (
                  <div className="flex flex-wrap items-center gap-2">
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
                    <ShareMomentButton
                      prompt={messages.slice(0, i).reverse().find((x) => x.role === "user")?.content ?? "Démonte mon pari"}
                      punchline={msg.punchline.text}
                    />
                  </div>
                ) : null}
                {streaming && (
                  <span className="ml-1 inline-flex items-center gap-1 align-middle" aria-label="BetGPT répond">
                    <span className="h-1.5 w-1.5 animate-[bounce_0.6s_ease-in-out_infinite] rounded-full bg-sage" />
                    <span className="h-1.5 w-1.5 animate-[bounce_0.6s_ease-in-out_0.12s_infinite] rounded-full bg-sage" />
                    <span className="h-1.5 w-1.5 animate-[bounce_0.6s_ease-in-out_0.24s_infinite] rounded-full bg-sage" />
                  </span>
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
