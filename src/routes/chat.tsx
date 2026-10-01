import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import { ChatPanel } from "@/components/chat-panel";
import { SITE_URL } from "@/lib/seo";

export const Route = createFileRoute("/chat")({
  pendingMs: 0,
  pendingComponent: ChatPending,
  validateSearch: (search: Record<string, unknown>): { q?: string; roast?: boolean } => ({
    q: typeof search.q === "string" ? search.q : undefined,
    roast: search.roast === "1" || search.roast === 1 || search.roast === true,
    share_source: typeof search.share_source === "string" ? search.share_source.slice(0, 24) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Chat BetGPT — pronostics football" },
      { name: "robots", content: "noindex, follow" },
      { name: "googlebot", content: "noindex, follow" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/chat` }],
  }),
  component: ChatPage,
});

function ChatPending() {
  return (
    <div className="space-y-6">
      <section className="hero-panel p-6 sm:p-8">
        <p className="eyebrow">Assistant football</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Chat BetGPT</h1>
        <p className="mt-3 text-base text-mist">Ouverture de l’assistant…</p>
      </section>
      <div className="surface-card min-h-[24rem] p-6 text-sm text-mist">Chargement du chat.</div>
    </div>
  );
}

function ChatPage() {
  const { q, roast, share_source } = Route.useSearch();
  return (
    <div className="space-y-6">
      <section className="hero-panel p-6 sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
          <div>
            <p className="eyebrow">Assistant football</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">Pose ta question à BetGPT</h1>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-mist sm:text-lg">
              Analyse un match, une cote ou un scénario de score dans une interface plus claire. Les données locales restent signalées lorsque l’IA n’est pas disponible.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="chip-pill"><MessageCircle size={15} />Analyse conversationnelle</span>
              <span className="chip-pill"><ShieldCheck size={15} />Données distinguées des hypothèses</span>
              <span className="chip-pill"><Sparkles size={15} />Réponses orientées football</span>
            </div>
          </div>
          <aside className="surface-card p-5">
            <p className="text-sm font-semibold text-paper">Exemples utiles</p>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-mist">
              <li>• « Analyse PSG - Marseille »</li>
              <li>• « Pourquoi cette cote est intéressante ? »</li>
              <li>• « Quel scénario de score est le plus plausible ? »</li>
            </ul>
          </aside>
        </div>
      </section>
      <section className="section-card overflow-hidden p-2 sm:p-3">
        <ChatPanel seed={q} initialMode={roast ? "ROAST" : "NORMAL"} shareSource={share_source} />
      </section>
    </div>
  );
}
