import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { getControlCenter, saveAdminSettings, setupAdminGate, unlockAdmin } from "@/lib/desk.functions";
import { ALL_LEAGUES, LEAGUE_LABEL } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import type { AdminSettings } from "@/engine/admin";
import type { AffiliateClick } from "@/engine/clicks";
import type { AffiliateBookReadiness } from "@/engine/affiliate-conversion";
import type { AffiliateClickSummaryRow } from "@/lib/store";
import { AFF_BOOKS } from "@/engine/aff-tag";
import type { Digest } from "@/engine/email";
import { ShareKit } from "@/components/share-kit";
import { getHunterObs } from "@/lib/hunter.functions";

export const Route = createFileRoute("/admin")({
  loader: () => getControlCenter(),
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, nofollow" },
      { name: "googlebot", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPage,
});

const LEAGUES = ALL_LEAGUES;

function AdminPage() {
  const boot = Route.useLoaderData();
  const [pin, setPin] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [admin, setAdmin] = useState<AdminSettings | null>(null);
  const [clicks, setClicks] = useState<AffiliateClick[]>([]);
  const [digest, setDigest] = useState<Digest | null>(null);
  const [minEv, setMinEv] = useState("");
  const [emailTo, setEmailTo] = useState("");
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [freeze, setFreeze] = useState(false);
  const [leagues, setLeagues] = useState<AdminSettings["leagues"] | undefined>();
  const [affTags, setAffTags] = useState<Record<string, string>>({});
  const [legalName, setLegalName] = useState("");
  const [siret, setSiret] = useState("");
  const [address, setAddress] = useState("");
  const [director, setDirector] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [tva, setTva] = useState("");
  const [adsensePub, setAdsensePub] = useState("");
  const [saved, setSaved] = useState("");
  const [obs, setObs] = useState<Awaited<ReturnType<typeof getHunterObs>> | null>(null);
  const [metrics, setMetrics] = useState<{ e: string; n: number }[]>([]);
  const [affiliateState, setAffiliateState] = useState<{ status: string; monetizedCount: number; totalBooks: number; books: AffiliateBookReadiness[] } | null>(null);
  const [affiliateStats, setAffiliateStats] = useState<AffiliateClickSummaryRow[]>([]);
  const [ledger, setLedger] = useState<{
    total: number;
    settled: number;
    unverified: number;
    partial: number;
    legacy: number;
    locked: number;
    hashed: number;
    missingResult: number;
    beforeKickoff: number;
  } | null>(null);
  const [legalOk, setLegalOk] = useState(Boolean(boot.legalReady));
  const needsSetup = boot.needsSetup;
  const adminOff = Boolean(boot.adminDisabled);

  function apply(next: AdminSettings, c: AffiliateClick[], d: Digest | null) {
    setAdmin(next);
    setClicks(c);
    setDigest(d);
    setMinEv(String(Math.round(next.minEv * 1000) / 10));
    setEmailTo(next.emailTo.join(", "));
    setEmailEnabled(next.emailEnabled);
    setFreeze(next.freezeBets);
    setLeagues(next.leagues);
    setAffTags(next.affTags ?? {});
    setLegalName(next.legalName ?? "");
    setSiret(next.siret ?? "");
    setAddress(next.address ?? "");
    setDirector(next.director ?? "");
    setContactEmail(next.contactEmail ?? "");
    setTva(next.tva ?? "");
    setAdsensePub(next.adsensePub ?? "");
    try {
      sessionStorage.setItem("betgpt-admin", "1");
    } catch {
      /* */
    }
  }

  async function enter() {
    setError("");
    if (needsSetup) {
      const r = await setupAdminGate({ data: { pin } });
      if (!r.ok) {
        setError(r.error);
        return;
      }
    }
    const u = await unlockAdmin({ data: { pin } });
    if (!u.ok) {
      setError(u.error);
      return;
    }
    setToken(u.token);
    try {
      sessionStorage.setItem("betgpt-admin-token", u.token);
    } catch {
      /* */
    }
    apply(u.admin, u.clicks, u.digest);
    setLegalOk(Boolean(u.legalReady));
    setMetrics(u.analytics ?? []);
    setAffiliateState(u.affiliate ?? null);
    setAffiliateStats(u.affiliateStats ?? []);
    setLedger(u.ledger ?? null);
    void getHunterObs().then(setObs).catch(() => undefined);
  }

  async function save() {
    if (!admin || !token) return;
    const ev = Number(minEv.replace(",", ".")) / 100;
    const r = await saveAdminSettings({
      data: {
        token,
        minEv: Number.isFinite(ev) ? ev : admin.minEv,
        freezeBets: freeze,
        emailEnabled,
        emailTo: emailTo
          .split(/[,;\s]+/)
          .map((s) => s.trim())
          .filter(Boolean),
        leagues: leagues ?? admin.leagues,
        affTags,
        legalName,
        siret,
        address,
        director,
        contactEmail,
        tva,
        adsensePub,
      },
    });
    if (!r.ok) {
      setSaved(r.error);
      return;
    }
    setAdmin(r.admin);
    setAffiliateState(r.affiliate ?? null);
    setAffiliateStats(r.affiliateStats ?? []);
    setSaved(r.affiliate?.status === "MONETIZED" ? "Enregistré · affiliation active." : "Enregistré · tracking prêt.");
  }

  if (adminOff) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <h1 className="text-2xl font-semibold">Admin désactivé</h1>
        <p className="text-sm text-mist">
          En production, l’accès rédaction exige une clé serveur (ADMIN_KEY). Le premier visiteur ne
          devient pas admin.
        </p>
      </div>
    );
  }

  if (!admin) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <h1 className="text-2xl font-semibold">Accès rédaction</h1>
        <p className="text-sm text-mist">
          {needsSetup ? "Première fois : choisis un mot de passe (8 caractères min)." : "Mot de passe admin."}
        </p>
        <input
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="block w-full rounded-md border border-line bg-surface px-3 py-2"
        />
        <Button type="button" onClick={() => void enter()}>
          Entrer
        </Button>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </div>
    );
  }

  const lg = leagues ?? admin.leagues;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl tracking-tight">Réglages</h1>
        {!legalOk ? (
          <p className="mt-2 rounded-md border border-clay/50 bg-clay/10 px-3 py-2 text-sm text-paper">
            LEGAL_READY = false. SIRET, adresse et directeur manquent : les pages publiques n’affichent
            pas de placeholders. La mise en production commerciale n’est pas prête.
          </p>
        ) : (
          <p className="mt-2 text-sm text-sage">LEGAL_READY = true</p>
        )}
      </header>
      {metrics.length ? (
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="font-display text-xl">Analytics (serveur)</h2>
          <ul className="mt-2 space-y-1 text-sm text-mist">
            {metrics.map((m) => (
              <li key={m.e}>
                {m.e} : <span className="tabular text-paper">{m.n}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="font-display text-xl">Analytics (serveur)</h2>
          <p className="mt-2 text-sm text-mist">Aucun événement agrégé pour l’instant (UNKNOWN).</p>
        </section>
      )}
      {ledger ? (
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="font-display text-xl">Registre pronostics</h2>
          <p className="mt-2 text-sm text-mist">
            {ledger.total} lignes · {ledger.beforeKickoff} avant coup d'envoi · {ledger.settled} tranchés ·{" "}
            {ledger.locked} verrouillés · {ledger.hashed} hashés
          </p>
          <p className="mt-1 text-sm text-mist">
            Non vérifiés {ledger.unverified} · partiels {ledger.partial} · hérités {ledger.legacy} · résultats
            manquants {ledger.missingResult}
          </p>
        </section>
      ) : null}
      <ShareKit token={token} />
      {obs ? (
        <section className="rounded-xl border border-line bg-surface p-5 space-y-2">
          <h2 className="font-display text-xl">Observabilité Hunter</h2>
          <p className="text-sm text-mist">
            {obs.source ? `${obs.source} · ` : ""}
            Archive n={obs.historyN.toLocaleString("fr-FR")} · live {obs.liveN} matches
            {obs.liveAsOf ? ` · ${obs.liveAsOf}` : " · live vide"}
            {obs.archive ? ` · ${obs.archive.overallStale ? "STALE" : "FRESH"}` : ""}
          </p>
          {obs.archive?.leagues?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[28rem] text-left text-sm">
                <thead className="border-b border-line text-xs uppercase tracking-wider text-muted">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Ligue</th>
                    <th className="py-2 pr-3 font-medium">Matches</th>
                    <th className="py-2 pr-3 font-medium">Dernier</th>
                    <th className="py-2 pr-3 font-medium">Saison</th>
                    <th className="py-2 pr-3 font-medium">Retard</th>
                    <th className="py-2 font-medium">État</th>
                  </tr>
                </thead>
                <tbody>
                  {obs.archive.leagues.map((l) => (
                    <tr key={l.league} className="border-b border-line last:border-0">
                      <td className="py-2 pr-3">{l.label}</td>
                      <td className="py-2 pr-3 tabular">{l.n.toLocaleString("fr-FR")}</td>
                      <td className="py-2 pr-3 tabular">{l.latest ? l.latest.slice(0, 10) : "—"}</td>
                      <td className="py-2 pr-3 tabular">{l.latestSeason || "—"}</td>
                      <td className="py-2 pr-3 tabular">{l.daysBehind} j</td>
                      <td className="py-2">{l.stale || l.n === 0 ? "STALE" : "FRESH"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <p className="text-sm text-mist">
            Cache hunter hits {obs.hunterCacheHits} / miss {obs.hunterCacheMiss} · dernier calcul {obs.hunterComputeMs} ms
          </p>
          <ul className="text-sm text-mist">
            {Object.entries(obs.counts).map(([k, v]) => (
              <li key={k}>
                {k} : {v}
              </li>
            ))}
          </ul>
          {obs.lastError ? <p className="text-sm text-rust">{obs.lastError}</p> : null}
        </section>
      ) : null}
      <section className="rounded-xl border border-line bg-surface p-5 space-y-4">
        <h2 className="font-display text-xl">Ligues</h2>
        <div className="flex flex-wrap gap-2">
          {LEAGUES.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setLeagues((l) => ({ ...(l ?? admin.leagues), [id]: !lg[id] }))}
              className={
                lg[id]
                  ? "min-h-11 rounded-md bg-sage px-3 text-sm text-white"
                  : "min-h-11 rounded-md border border-line px-3 text-sm text-mist"
              }
            >
              {LEAGUE_LABEL[id]}
            </button>
          ))}
        </div>
      </section>
      <section className="rounded-xl border border-line bg-surface p-5 space-y-4">
        <h2 className="font-display text-xl">Identité légale (ANJ / Ads / affiliation)</h2>
        <p className="text-sm text-mist">Sans SIRET et e-mail réel, Betclic et Google Ads recaleront le dossier.</p>
        <label className="block text-sm">Raison sociale<input value={legalName} onChange={(e) => setLegalName(e.target.value)} className="mt-1 block w-full rounded-md border border-line bg-surface px-3 py-2" /></label>
        <label className="block text-sm">SIRET<input value={siret} onChange={(e) => setSiret(e.target.value)} className="mt-1 block w-full rounded-md border border-line bg-surface px-3 py-2" /></label>
        <label className="block text-sm">Adresse<input value={address} onChange={(e) => setAddress(e.target.value)} className="mt-1 block w-full rounded-md border border-line bg-surface px-3 py-2" /></label>
        <label className="block text-sm">Directeur de publication<input value={director} onChange={(e) => setDirector(e.target.value)} className="mt-1 block w-full rounded-md border border-line bg-surface px-3 py-2" /></label>
        <label className="block text-sm">E-mail contact<input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="mt-1 block w-full rounded-md border border-line bg-surface px-3 py-2" /></label>
        <label className="block text-sm">TVA<input value={tva} onChange={(e) => setTva(e.target.value)} className="mt-1 block w-full rounded-md border border-line bg-surface px-3 py-2" /></label>
        <label className="block text-sm">
          ID AdSense (pub-…)
          <input
            value={adsensePub}
            onChange={(e) => setAdsensePub(e.target.value.trim())}
            placeholder="pub-0000000000000000"
            className="mt-1 block w-full rounded-md border border-line bg-surface px-3 py-2 font-mono"
          />
        </label>
      </section>
      <section className="rounded-xl border border-line bg-surface p-5 space-y-4">
        <h2 className="font-display text-xl">Mises</h2>
        <label className="block text-sm">
          Écart minimum pour miser (%)
          <input
            value={minEv}
            onChange={(e) => setMinEv(e.target.value)}
            className="mt-1 block w-full max-w-xs rounded-md border border-line bg-surface px-3 py-2 text-paper"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={freeze} onChange={(e) => setFreeze(e.target.checked)} />
          Geler toutes les mises
        </label>
      </section>
      <section className="rounded-xl border border-line bg-surface p-5 space-y-4">
        <h2 className="font-display text-xl">Mail du jour</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={emailEnabled} onChange={(e) => setEmailEnabled(e.target.checked)} />
          Envoyer l'opportunité du jour
        </label>
        <label className="block text-sm">
          Destinataires
          <input
            value={emailTo}
            onChange={(e) => setEmailTo(e.target.value)}
            className="mt-1 block w-full max-w-lg rounded-md border border-line bg-surface px-3 py-2 text-paper"
          />
        </label>
        {digest ? (
          <p className="text-sm text-mist">
            {digest.date} · {digest.subject}
          </p>
        ) : null}
      </section>
      <section className="rounded-xl border border-line bg-surface p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl">Affiliation · Control Center</h2>
            <p className="mt-1 text-sm text-mist">
              Tracking réel des clics. Les revenus restent UNVERIFIED tant qu'aucun postback ou API partenaire n'est connecté.
            </p>
          </div>
          <span className={
            affiliateState?.status === "MONETIZED"
              ? "rounded-full bg-sage/15 px-3 py-1 text-xs font-semibold text-sage"
              : "rounded-full border border-line px-3 py-1 text-xs font-semibold text-mist"
          }>
            {affiliateState?.status ?? "UNVERIFIED"}
          </span>
        </div>
        <p className="text-sm text-mist">
          {affiliateState
            ? `${affiliateState.monetizedCount}/${affiliateState.totalBooks} bookmakers monétisés · les autres restent TRACKING_READY`
            : "État d'affiliation indisponible."}
        </p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {AFF_BOOKS.map((book) => {
            const state = affiliateState?.books.find((row) => row.key === book.key);
            const stats = affiliateStats.find((row) => row.book.toLowerCase().replace(/\s+/g, "").includes(book.key));
            const mode = state?.mode ?? "UNVERIFIED";
            return (
              <div key={book.key} className="rounded-lg border border-line bg-background/30 p-4">
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-sm text-paper">{book.label}</strong>
                  <span className={mode === "MONETIZED" ? "text-xs font-semibold text-sage" : "text-xs text-mist"}>
                    {mode}
                  </span>
                </div>
                <p className="mt-2 text-xs text-mist">
                  Source : {state?.source ?? "unknown"} · 24 h : {stats?.clicks24h ?? 0} clics · 7 j : {stats?.clicks7d ?? 0} clics
                </p>
                <p className="mt-1 text-xs text-muted">
                  Dernier clic : {stats?.lastClick ? format(new Date(stats.lastClick), "d MMM HH:mm", { locale: fr }) : "—"}
                </p>
              </div>
            );
          })}
        </div>
      </section>
      <section className="rounded-xl border border-line bg-surface p-5 space-y-4">
        <h2 className="font-display text-xl">IDs affiliés (caisse)</h2>
        <p className="text-sm text-mist">
          Colle le btag / clickid de chaque book. Sans ça, le clic part chez eux, l’argent aussi.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {AFF_BOOKS.map((b) => (
            <label key={b.key} className="block text-sm">
              {b.label} ({b.param})
              <input
                value={affTags[b.key] ?? ""}
                onChange={(e) => setAffTags((t) => ({ ...t, [b.key]: e.target.value.trim() }))}
                className="mt-1 block w-full rounded-md border border-line bg-surface px-3 py-2 font-mono text-paper"
                autoComplete="off"
              />
            </label>
          ))}
        </div>
      </section>
      <div className="flex items-center gap-3">
        <Button type="button" onClick={() => void save()}>
          Enregistrer
        </Button>
        {saved ? <span className="text-sm text-sage">{saved}</span> : null}
      </div>
      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="font-display text-xl">Clics</h2>
        {clicks.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Aucun clic.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {clicks.slice(0, 20).map((c, i) => (
              <li key={`${c.at}-${i}`} className="text-mist">
                {format(new Date(c.at), "d MMM HH:mm", { locale: fr })} · {c.book}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}