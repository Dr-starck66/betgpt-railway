import { useEffect, useMemo, useState } from "react";
import { buildSharePosts, type ShareTicket } from "@/lib/share-copy";
import { getBroadcast, getPredictionHook, setBroadcast, setPredictionHook } from "@/lib/broadcast.functions";
import { getDesk } from "@/lib/desk.functions";
import { skipEuropeFrenchProno } from "@/engine/french-clubs";

function todayParis(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
}

export function ShareKit({ token }: { token: string }) {
  const [tickets, setTickets] = useState<ShareTicket[]>([]);
  const posts = useMemo(() => buildSharePosts(tickets), [tickets]);
  const [copied, setCopied] = useState<string | null>(null);
  const [webhook, setWebhook] = useState("");
  const [on, setOn] = useState(false);
  const [pending, setPending] = useState(0);
  const [sent, setSent] = useState(0);
  const [nextDue, setNextDue] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hookUrl, setHookUrl] = useState("http://127.0.0.1:8787/prediction");
  const [hookSaved, setHookSaved] = useState("");

  async function refresh() {
    try {
      const s = await getBroadcast({ data: { token } });
      setOn(s.on);
      setPending(s.pending);
      setSent(s.sent);
      setNextDue(s.nextDue);
      setErr(s.lastError);
      const h = await getPredictionHook({ data: { token } });
      if (h.url) setHookUrl(h.url);
    } catch {
      /* */
    }
  }

  useEffect(() => {
    void refresh();
    void getDesk()
      .then((desk) => {
        const today = todayParis();
        const seen = new Set<string>();
        const out: ShareTicket[] = [];
        for (const p of desk?.predictions ?? []) {
          if (skipEuropeFrenchProno(p)) continue;
          const match = desk?.matches.find((m) => m.id === p.matchId);
          if (match?.status === "finished") continue;
          const day = new Date(p.kickoff).toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
          if (day !== today && match?.status !== "live") continue;
          const m = p.markets.find((x) => x.decision === "BET");
          if (!m || seen.has(p.matchId)) continue;
          seen.add(p.matchId);
          out.push({
            home: p.home.name,
            away: p.away.name,
            label: m.label,
            odds: m.bestOdds,
            league: p.league,
          });
        }
        setTickets(out);
      })
      .catch(() => undefined);
  }, [token]);

  async function copy(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      window.setTimeout(() => setCopied((c) => (c === id ? null : c)), 1600);
    } catch {
      /* */
    }
  }

  async function save(nextOn: boolean) {
    setBusy(true);
    try {
      const s = await setBroadcast({ data: { token, webhook, on: nextOn } });
      setOn(s.on);
      setPending(s.pending);
      setSent(s.sent);
      setNextDue(s.nextDue);
      setErr(s.lastError);
    } finally {
      setBusy(false);
    }
  }

  const wait =
    nextDue && nextDue > Date.now()
      ? Math.max(1, Math.ceil((nextDue - Date.now()) / 60000))
      : null;

  return (
    <section className="rounded-lg border border-line bg-surface p-4 sm:p-5">
      <h2 className="text-lg font-semibold tracking-tight">Diffusion auto</h2>
      <p className="mt-1 max-w-2xl text-sm text-mist">
        Visible uniquement ici. 6 textes différents, un toutes les 10 min, vers ton webhook.
      </p>
      <form
        className="mt-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void save(true);
        }}
      >
        <input
          type="url"
          required
          placeholder="https://discord.com/api/webhooks/… ou Make"
          value={webhook}
          onChange={(e) => setWebhook(e.target.value)}
          className="min-h-11 flex-1 rounded-md border border-line bg-raised px-3 text-sm text-paper placeholder:text-muted"
        />
        <button
          type="submit"
          disabled={busy}
          className="min-h-11 rounded-md bg-sage px-4 text-sm font-semibold text-ink disabled:opacity-40"
        >
          {on ? "Mettre à jour" : "Activer"}
        </button>
        {on ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void save(false)}
            className="min-h-11 rounded-md border border-line px-4 text-sm text-mist"
          >
            Stop
          </button>
        ) : null}
      </form>
      <p className="mt-2 text-xs text-muted">
        {on
          ? `Actif · ${sent} envoyé${sent > 1 ? "s" : ""} · ${pending} en file${wait ? ` · prochain dans ${wait} min` : ""}`
          : "Inactif"}
        {err ? ` · ${err}` : ""}
      </p>
      <form
        className="mt-5 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void setPredictionHook({ data: { token, url: hookUrl } }).then((r) => {
            setHookUrl(r.url);
            setHookSaved("Branché.");
          });
        }}
      >
        <input
          type="url"
          value={hookUrl}
          onChange={(e) => setHookUrl(e.target.value)}
          className="min-h-11 flex-1 rounded-md border border-line bg-raised px-3 font-mono text-sm text-paper"
        />
        <button type="submit" className="min-h-11 rounded-md border border-line px-4 text-sm font-medium text-mist">
          FreeWebhookAI
        </button>
      </form>
      <p className="mt-1 text-xs text-muted">
        Chaque nouveau prono part en POST JSON vers cette URL (défaut 127.0.0.1:8787/prediction). {hookSaved}
      </p>
      <ul className="mt-4 grid gap-3 lg:grid-cols-3">
        {posts.map((p) => (
          <li key={p.id} className="flex flex-col rounded-md border border-line bg-raised p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-sage">{p.title}</p>
            <pre className="mt-2 flex-1 whitespace-pre-wrap font-sans text-sm leading-relaxed text-paper">
              {p.text}
            </pre>
            <button
              type="button"
              onClick={() => void copy(p.id, p.text)}
              className="mt-3 min-h-9 self-start rounded-md border border-line px-3 text-sm font-medium text-mist hover:text-paper"
            >
              {copied === p.id ? "Copié" : "Copier"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
