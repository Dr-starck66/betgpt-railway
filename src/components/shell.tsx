import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { COCON_PILIERS } from "@/lib/cocon";
import { BRAND_LOGO, LEGAL_ANJ } from "@/lib/image-seo";
import { LEAGUE_HUBS } from "@/lib/programmatic";
import { AgeGate } from "@/components/age-gate";
import { ConsentAds, openCookieSettings } from "@/components/consent-ads";
import { SeoImg } from "@/components/seo-img";
import { SemanticFlowRepairLinks } from "@/components/semantic-flow-repair-links";
import { cn } from "@/lib/utils";
import { markVisit } from "@/lib/analytics";
import { Home, Radar, Activity, MessageCircle, Menu, X, ShieldCheck, Sparkles } from "lucide-react";

const MOBILE_PRIMARY = [
  { to: "/", label: "Accueil", icon: Home },
  { to: "/pronostics-sportifs", label: "Pronostics", icon: Radar },
  { to: "/scores-en-direct", label: "Scores", icon: Activity },
  { to: "/chat", label: "Chat IA", icon: MessageCircle },
] as const;

const PRIMARY = [
  { to: "/", label: "Accueil" },
  { to: "/pronostics-sportifs", label: "Pronostics" },
  { to: "/scores-en-direct", label: "Scores live" },
  { to: "/resultats-football", label: "Résultats" },
  { to: "/actualites", label: "Actualités" },
  { to: "/comparer-cotes", label: "Cotes" },
  { to: "/ledger", label: "Bilan ROI" },
  { to: "/chat", label: "Chat IA" },
] as const;

const MORE = [
  { to: "/score-hunter", label: "Hunter IA" },
  { to: "/opportunities", label: "Opportunités" },
  { to: "/pari-du-jour", label: "Pari du jour" },
  { to: "/ledger", label: "Bilan public" },
  { to: "/blog", label: "Guides & analyses" },
  { to: "/forum", label: "Forum" },
  { to: "/actu", label: "Fil actu" },
  { to: "/chat", label: "Chat BetGPT" },
] as const;

const ADMIN = { to: "/admin", label: "Réglages" } as const;

function readAdmin(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem("betgpt-admin") === "1";
  } catch {
    return false;
  }
}

function MenuGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[1.25rem] border border-line bg-surface p-3 shadow-sm">
      <p className="px-2 pb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{title}</p>
      <div className="grid gap-1">{children}</div>
    </section>
  );
}

function MenuLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to as never} className="menu-panel-link">
      {label}
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [admin, setAdmin] = useState(false);
  const [more, setMore] = useState(false);
  useEffect(() => {
    setAdmin(readAdmin());
    setMore(false);
  }, [pathname]);
  useEffect(() => {
    markVisit();
  }, []);

  return (
    <div className="app-shell flex min-h-dvh min-w-0 flex-col bg-pitch text-paper">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[80] focus:rounded-full focus:bg-sage focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink"
      >
        Aller au contenu
      </a>
      <AgeGate />
      <ConsentAds />

      <div className="bg-header text-on-header">
        <div className="mx-auto flex max-w-[1480px] flex-wrap items-center justify-center gap-x-5 gap-y-1 px-4 py-2 text-[11px] font-medium tracking-wide text-on-header/78 sm:justify-between sm:px-6">
          <div className="inline-flex items-center gap-2">
            <ShieldCheck size={14} className="text-sage" />
            18+ · Jeu responsable · BetGPT n’est pas un opérateur de paris
          </div>
          <a href="/jeu-responsable" className="inline-flex items-center gap-2 text-sage hover:opacity-90">
            <Sparkles size={14} />
            Aide 09 74 75 13 13
          </a>
        </div>
      </div>

      <header className="sticky top-0 z-30 border-b border-line/80 bg-white/95 shadow-[0_8px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl">
        <div className="mx-auto flex min-h-[76px] w-full min-w-0 max-w-[1480px] items-center justify-between gap-4 px-4 py-2 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <Link to="/" className="flex min-h-11 items-center gap-3">
              <SeoImg
                seo={{ ...BRAND_LOGO, width: 40, height: 40 }}
                priority
                width={40}
                height={40}
                className="h-10 w-10 rounded-2xl border border-line/80 object-cover shadow-sm"
              />
              <div className="min-w-0">
                <span className="block text-[18px] font-extrabold tracking-tight text-paper">BetGPT</span>
                <span className="hidden text-xs font-medium text-muted sm:block">
                  Scores, pronostics et actualités football
                </span>
              </div>
            </Link>
            <div className="hidden items-center gap-2 2xl:flex">
              <span className="chip-pill border-sage/25 bg-sage/10 text-link">France · fr-FR</span>
              <span className="chip-pill">Approche éditoriale sélective</span>
            </div>
          </div>

          <nav className="hidden flex-1 items-center justify-end gap-1.5 xl:flex" aria-label="Principal">
            {PRIMARY.map((item) => {
              const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  preload={item.to === "/chat" ? false : "intent"}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-semibold transition-colors",
                    active
                      ? "bg-sage/12 text-link"
                      : "text-mist hover:bg-slate-100 hover:text-paper",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
            <button
              type="button"
              aria-expanded={more}
              aria-controls="nav-more"
              onClick={() => setMore((v) => !v)}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors",
                more
                  ? "border-sage/30 bg-sage/12 text-link"
                  : "border-line bg-white text-mist hover:border-sage/30 hover:text-paper",
              )}
            >
              <Menu size={17} aria-hidden="true" />
              Tout BetGPT
            </button>
          </nav>

          <button
            type="button"
            aria-label={more ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={more}
            aria-controls="nav-more"
            onClick={() => setMore((v) => !v)}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line bg-white text-paper shadow-sm xl:hidden"
          >
            {more ? <X size={22} /> : <Menu size={22} />}
          </button>

          <nav
            className="mobile-nav fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 rounded-[1.35rem] border border-line/90 bg-white/94 text-paper shadow-[0_18px_46px_rgba(15,23,42,0.12)] backdrop-blur xl:hidden"
            aria-label="Principal mobile"
          >
            {MOBILE_PRIMARY.map((item) => {
              const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  preload="intent"
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-15 min-w-0 flex-col items-center justify-center gap-1 px-1 text-[11px] font-semibold",
                    active ? "text-link" : "text-muted",
                  )}
                >
                  <span className={cn("rounded-full p-2", active ? "bg-sage/14 text-link" : "bg-transparent")}>
                    <Icon size={19} aria-hidden="true" />
                  </span>
                  {item.label}
                </Link>
              );
            })}
            <button
              type="button"
              aria-expanded={more}
              aria-controls="nav-more"
              onClick={() => setMore((v) => !v)}
              className="inline-flex min-h-15 min-w-0 flex-col items-center justify-center gap-1 px-1 text-[11px] font-semibold text-muted"
            >
              <span className="rounded-full p-2">
                <Menu size={19} aria-hidden="true" />
              </span>
              Plus
            </button>
          </nav>
        </div>

        {more ? (
          <div
            id="nav-more"
            onKeyDown={(e) => {
              if (e.key === "Escape") setMore(false);
            }}
            className="border-t border-line/80 bg-white/96 px-4 py-4 backdrop-blur"
          >
            <div className="mx-auto grid max-w-[1480px] gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MenuGroup title="Matchs & pronostics">
                {MORE.filter((item) => ["/score-hunter", "/opportunities", "/pari-du-jour", "/ledger"].includes(item.to)).map((item) => (
                  <MenuLink key={item.to} to={item.to} label={item.label} />
                ))}
                <MenuLink to="/resultats-football" label="Résultats" />
                <MenuLink to="/calendrier" label="Calendrier" />
                <MenuLink to="/classement" label="Classements" />
              </MenuGroup>

              <MenuGroup title="Compétitions">
                {LEAGUE_HUBS.map((item) => (
                  <a key={item.path} href={item.path} className="menu-panel-link">
                    {item.title}
                  </a>
                ))}
              </MenuGroup>

              <MenuGroup title="Contenus & communauté">
                {MORE.filter((item) => ["/blog", "/forum", "/actu", "/chat"].includes(item.to)).map((item) => (
                  <MenuLink key={item.to} to={item.to} label={item.label} />
                ))}
                <MenuLink to="/actualites" label="Actualités" />
                <MenuLink to="/guides" label="Guides" />
                <MenuLink to="/chat" label="Chat BetGPT" />
              </MenuGroup>

              <MenuGroup title="Outils & statistiques">
                <MenuLink to="/statistics" label="Statistiques" />
                <MenuLink to="/comparer-cotes" label="Comparer les cotes" />
                <MenuLink to="/calculateur-mise" label="Calculateur de mise" />
                <MenuLink to="/meilleur-site-pronostic" label="Guide des sites" />
                {admin ? <MenuLink to={ADMIN.to} label={ADMIN.label} /> : null}
              </MenuGroup>
            </div>
          </div>
        ) : null}
      </header>

      <main id="contenu" className="mx-auto min-w-0 w-full max-w-[1480px] flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
        <SemanticFlowRepairLinks pathname={pathname} />
      </main>

      <footer className="border-t border-line/80 bg-white/92 backdrop-blur">
        <div className="mx-auto grid max-w-[1480px] gap-6 px-4 py-8 text-sm text-muted sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          <div className="space-y-3">
            <p className="font-semibold text-paper">Produit</p>
            <div className="flex flex-col gap-2">
              <a href="/pronostics-sportifs" className="hover:text-paper">Pronostics sportifs</a>
              <a href="/chat" className="hover:text-paper">Demander à BetGPT</a>
              <a href="/scores-en-direct" className="hover:text-paper">Scores en direct</a>
              <a href="/resultats-football" className="hover:text-paper">Résultats football</a>
              <a href="/actualites" className="hover:text-paper">Actualités</a>
              <a href="/pari-du-jour" className="hover:text-paper">Pari du jour</a>
              <a href="/opportunities" className="hover:text-paper">Opportunités</a>
            </div>
          </div>

          <div className="space-y-3">
            <p className="font-semibold text-paper">Compétitions et stats</p>
            <div className="flex flex-col gap-2">
              <a href="/statistics" className="hover:text-paper">Statistiques</a>
              <a href="/classement" className="hover:text-paper">Classement</a>
              <a href="/calendrier" className="hover:text-paper">Calendrier</a>
              {LEAGUE_HUBS.map((h) => (
                <a key={h.path} href={h.path} className="hover:text-paper">
                  {h.title}
                </a>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <p className="font-semibold text-paper">Ressources</p>
            <div className="flex flex-col gap-2">
              <a href="/paris-football" className="hover:text-paper">Paris football</a>
              <a href="/pronos-football" className="hover:text-paper">Pronos football</a>
              <a href="/blog" className="hover:text-paper">Blog</a>
              <a href="/forum" className="hover:text-paper">Forum</a>
              <a href="/comparer-cotes" className="hover:text-paper">Comparer les cotes</a>
              {COCON_PILIERS.map((p) => (
                <a key={p.path} href={p.path} className="hover:text-paper" title={p.title}>
                  {p.title}
                </a>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <p className="font-semibold text-paper">Société / légal</p>
            <div className="flex flex-col gap-2">
              <a href="/about" className="hover:text-paper">À propos</a>
              <a href="/methodology" className="hover:text-paper">Méthode</a>
              <a href="/data-sources" className="hover:text-paper">Sources</a>
              <a href="/prediction-history" className="hover:text-paper">Historique</a>
              <a href="/editorial-policy" className="hover:text-paper">Politique éditoriale</a>
              <a href="/changelog" className="hover:text-paper">Changelog</a>
              <a href="/press" className="hover:text-paper">Presse</a>
              <a href="/mentions-legales" className="hover:text-paper">Mentions légales</a>
              <a href="/cgu" className="hover:text-paper">CGU</a>
              <a href="/confidentialite" className="hover:text-paper">Confidentialité</a>
              <a href="/cookies" className="hover:text-paper">Cookies</a>
              <button type="button" className="text-left hover:text-paper" onClick={() => openCookieSettings()}>
                Gérer les cookies
              </button>
              <a href="/jeu-responsable" className="hover:text-paper">Jeu responsable</a>
              <a href="/politique-publicite" className="hover:text-paper">Publicité</a>
              <a href="/contact" className="hover:text-paper">Contact</a>
              <a href="/sitemap" className="hover:text-paper">Plan du site</a>
            </div>
          </div>
        </div>

        <div className="border-t border-line/80 bg-slate-50/80">
          <div className="mx-auto flex max-w-[1480px] flex-col gap-4 px-4 py-7 sm:flex-row sm:items-center sm:gap-6 sm:px-6">
            <SeoImg
              seo={LEGAL_ANJ}
              width={250}
              height={107}
              className="h-16 w-auto shrink-0 object-contain sm:h-[4.5rem]"
            />
            <p className="max-w-3xl text-xs font-semibold leading-relaxed tracking-wide text-paper">
              LES JEUX D'ARGENT ET DE HASARD PEUVENT ÊTRE DANGEREUX : PERTES D'ARGENT, CONFLITS
              FAMILIAUX, ADDICTION. RETROUVEZ NOS CONSEILS SUR (
              <a href="tel:+33974751313" className="text-sage underline-offset-2 hover:underline">
                09-74-75-13-13
              </a>
              , APPEL NON SURTAXÉ).
            </p>
          </div>
        </div>
        <p className="mx-auto max-w-[1480px] px-4 pb-6 text-[11px] text-muted sm:px-6">
          Interdit aux mineurs. BetGPT n’est pas un opérateur de paris. Joueurs Info Service 09 74 75 13 13.
        </p>
      </footer>
    </div>
  );
}
