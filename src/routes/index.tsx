import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Activity, ArrowRight, Newspaper, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import { DailyBest } from "@/components/daily-best";
import { LatestNews } from "@/components/latest-news";
import { LiveScore } from "@/components/live-score";
import { MatchCard } from "@/components/match-card";
import { CoconMesh } from "@/components/cocon-mesh";
import { FollowedHome } from "@/components/followed-home";
import { HomeHunter } from "@/components/hunter-home";
import { NoticesBar } from "@/components/notices-bar";
import { TeamLine } from "@/components/crest";
import { getHomeDesk, getHomeSlice } from "@/lib/desk.functions";
import { LEAGUE_LABEL } from "@/lib/labels";
import { useLiveRefresh } from "@/lib/live-refresh";
import { meshHub, breadcrumbJsonLd } from "@/lib/cocon";
import { BRAND_OG, imageHeadTags } from "@/lib/image-seo";
import { SITE_URL } from "@/lib/seo";
import { ld } from "@/lib/ld";
import { fmtPct } from "@/lib/utils";
import { track } from "@/lib/analytics";
import type { LeagueId, MatchInput, PredictionRecord } from "@/engine/types";

export const Route = createFileRoute("/")({
  loader: () => getHomeDesk(),
  head: () => ({
    meta: [
      { title: "Scores en direct, pronostics et classements football | BetGPT" },
      {
        name: "description",
        content:
          "Scores en direct, pronostics et meilleures cotes FR. Ligue 1, Premier League, C1, Ligue Europa. Classements et calendrier sur betgpt.live.",
      },
      { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1" },
      { property: "og:title", content: "BetGPT — scores et pronos football en direct" },
      { property: "og:url", content: SITE_URL },
      ...imageHeadTags(BRAND_OG),
    ],
    links: [{ rel: "canonical", href: SITE_URL }],
  }),
  component: Home,
});

function uniq(matches: MatchInput[]): MatchInput[] {
  const seen = new Set<string>();
  return matches.filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}

function Home() {
  const data = Route.useLoaderData();
  const sliceFn = useServerFn(getHomeSlice);
  const [league, setLeague] = useState<LeagueId | "ALL">("ALL");
  const [matches, setMatches] = useState<MatchInput[]>(data.matches);
  const [predictions, setPredictions] = useState<PredictionRecord[]>(data.predictions);
  const [total, setTotal] = useState(data.total);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const requestId = useRef(0);
  const liveNow = matches.filter((m) => m.status === "live");
  const featuredStory = data.news.published[0] ?? null;
  useLiveRefresh(liveNow.length > 0);
  useEffect(() => {
    track("landing");
  }, []);

  async function loadLeague(next: LeagueId | "ALL") {
    const id = ++requestId.current;
    setLoadError(null);
    setBusy(true);
    try {
      const res = await sliceFn({ data: { offset: 0, league: next } });
      if (id !== requestId.current) return;
      setLeague(next);
      setMatches(res.matches);
      setPredictions(res.predictions);
      setTotal(res.total);
    } catch {
      if (id === requestId.current)
        setLoadError(
          "Impossible de charger cette compétition. Les rencontres précédentes sont conservées.",
        );
    } finally {
      if (id === requestId.current) setBusy(false);
    }
  }

  async function loadMore() {
    if (busy) return;
    const id = ++requestId.current;
    setLoadError(null);
    setBusy(true);
    try {
      const res = await sliceFn({ data: { offset: matches.length, league } });
      if (id !== requestId.current) return;
      setMatches(uniq([...matches, ...res.matches]));
      setPredictions([...predictions, ...res.predictions]);
      setTotal(res.total);
    } catch {
      if (id === requestId.current)
        setLoadError("La suite des rencontres n’a pas pu être chargée. Réessaie.");
    } finally {
      if (id === requestId.current) setBusy(false);
    }
  }

  return (
    <div className="space-y-10 sm:space-y-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: ld(
            breadcrumbJsonLd([
              { name: "BetGPT", href: "/" },
              { name: "Accueil football", href: "/" },
            ]),
          ),
        }}
      />
      <NoticesBar matches={matches} />
      <FollowedHome matches={matches} />

      <section className="betgpt-hero overflow-hidden rounded-[2rem] border border-slate-800 bg-header text-white shadow-[0_24px_70px_rgba(15,23,42,0.20)]">
        <div className="grid min-h-[430px] lg:grid-cols-[minmax(0,1.2fr)_minmax(340px,.8fr)]">
          <div className="relative overflow-hidden p-6 sm:p-8 lg:p-10">
            <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-sage/20 blur-3xl" />
            <div className="relative z-10">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-white/80">
                  <Activity size={14} className="text-sage" /> Football · France
                </span>
                <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-xs font-semibold text-white/70">
                  {liveNow.length > 0 ? `${liveNow.length} match${liveNow.length > 1 ? "s" : ""} en direct` : "Matchs du jour"}
                </span>
              </div>

              <h1 className="mt-6 max-w-4xl text-4xl font-black leading-[0.98] tracking-[-0.05em] text-white sm:text-6xl xl:text-7xl">
                Scores live, pronostics IA et données football.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg">
                Une lecture immédiate des matchs : probabilités 1/X/2, cotes disponibles, contexte, résultats et bilan public. L’information utile avant le contenu éditorial.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <Link to="/scores-en-direct" className="inline-flex min-h-12 items-center justify-center rounded-full bg-sage px-5 text-sm font-extrabold text-ink shadow-[0_12px_30px_rgba(124,194,58,0.28)]">
                  Scores en direct <ArrowRight size={17} className="ml-2" />
                </Link>
                <Link to="/pronostics-sportifs" className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/20 bg-white/8 px-5 text-sm font-bold text-white hover:bg-white/12">
                  Pronostics du jour
                </Link>
                <Link to="/comparer-cotes" className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/20 bg-white/8 px-5 text-sm font-bold text-white hover:bg-white/12">
                  Comparer les cotes
                </Link>
              </div>

              <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <HeroStat label="Matchs suivis" value={String(data.summary.nMatches)} />
                <HeroStat label="En direct" value={String(liveNow.length)} />
                <HeroStat label="Opportunités" value={String(data.summary.nBet)} />
                <HeroStat label="Écart moyen" value={fmtPct(data.summary.meanAbsEdge)} />
              </div>
            </div>
          </div>

          <aside className="border-t border-white/10 bg-white/[0.045] p-5 sm:p-7 lg:border-l lg:border-t-0">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-sage">À la une</p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-white">Le desk BetGPT</h2>
              </div>
              <Newspaper size={20} className="text-sage" />
            </div>

            {featuredStory ? (
              <a href={featuredStory.href} className="mt-5 block overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/8 transition hover:bg-white/10">
                <img src={featuredStory.image} alt={featuredStory.alt} width={1200} height={675} className="aspect-[16/8.5] w-full object-cover" loading="lazy" />
                <div className="p-4 sm:p-5">
                  <div className="flex flex-wrap gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-sage">
                    <span>{featuredStory.category}</span><span className="text-white/45">{featuredStory.time}</span>
                  </div>
                  <h3 className="mt-2 text-lg font-bold leading-snug text-white">{featuredStory.title}</h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-white/60">{featuredStory.lead}</p>
                  <span className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-sage">Lire l’article <ArrowRight size={16} /></span>
                </div>
              </a>
            ) : (
              <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-white/8 p-5 text-sm text-white/65">
                Aucune actualité forte publiée pour ce créneau. BetGPT privilégie la qualité à la quantité.
              </div>
            )}

            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <Link to="/ledger" className="rounded-2xl border border-white/10 bg-white/8 p-4 hover:bg-white/10">
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-white/45">Transparence</span>
                <span className="mt-1 block text-sm font-bold text-white">Voir le bilan public</span>
              </Link>
              <Link to="/methodology" className="rounded-2xl border border-white/10 bg-white/8 p-4 hover:bg-white/10">
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-white/45">Méthode</span>
                <span className="mt-1 block text-sm font-bold text-white">Comprendre le modèle</span>
              </Link>
            </div>
          </aside>
        </div>
      </section>

      {liveNow.length > 0 ? (
        <section className="section-card p-5 sm:p-6" aria-label="Rencontres en direct">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow">Live now</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">Matchs en direct</h2>
            </div>
            <Link to="/scores-en-direct" className="text-sm font-semibold text-link">
              Voir tous les scores
            </Link>
          </div>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {liveNow.map((m) => (
              <li key={m.id}>
                <Link
                  to="/match/$matchId"
                  params={{ matchId: m.slug ?? m.id }}
                  className="surface-card flex h-full flex-wrap items-center justify-between gap-3 p-4 transition-colors hover:border-sage/35"
                >
                  <TeamLine
                    home={m.home}
                    away={m.away}
                    size={34}
                    competition={m.competition}
                    className="min-w-0 flex-1"
                  />
                  <span className="shrink-0">
                    <LiveScore match={m} size="sm" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Matchs" value={String(data.summary.nMatches)} helper="rencontres suivies" />
        <Kpi label="Marchés mise" value={String(data.summary.nBet)} helper="opportunités pari" />
        <Kpi label="Surveiller" value={String(data.summary.nWatch)} helper="watchlist active" />
        <Kpi label="Écart moyen" value={fmtPct(data.summary.meanAbsEdge)} helper="edge moyen" />
      </section>

      <HomeHunter />

      <LatestNews published={data.news.published} planned={data.news.planned} />

      <section className="space-y-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="eyebrow">Calendrier éditorial et data</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-[2rem]">Prochains matchs à analyser</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-mist sm:text-base">
              Cette semaine d’abord, puis les championnats. Le moteur met en avant les rencontres les plus utiles à suivre, avec lecture rapide du contexte et du pari éventuel.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <FilterChip active={league === "ALL"} onClick={() => void loadLeague("ALL")}>
              Tous
            </FilterChip>
            {data.leagues.map((id) => (
              <FilterChip key={id} active={league === id} onClick={() => void loadLeague(id)}>
                {LEAGUE_LABEL[id]}
              </FilterChip>
            ))}
          </div>
        </div>

        {loadError ? (
          <p role="alert" className="surface-card border-rust/30 p-4 text-sm text-rust">
            {loadError}
          </p>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-2" aria-busy={busy}>
          {matches.map((m) => {
            const p = predictions.find((x) => x.matchId === m.id);
            if (!p) return null;
            return <MatchCard key={m.id} match={m} prediction={p} />;
          })}
        </div>

        {matches.length < total ? (
          <div className="flex justify-center">
            <button
              type="button"
              disabled={busy}
              onClick={() => void loadMore()}
              className="cta-secondary disabled:opacity-60"
            >
              {busy ? "Chargement…" : `Afficher 10 matchs de plus (${total - matches.length} restants)`}
            </button>
          </div>
        ) : null}
      </section>

      {data.dailyBest ? <DailyBest prediction={data.dailyBest.prediction} market={data.dailyBest.market} /> : null}

      <CoconMesh {...meshHub("/", "Accueil football", matches, "prono")} />
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-11 items-center rounded-full px-4 text-[13px] font-semibold whitespace-nowrap transition-colors ${
        active ? "bg-sage text-ink shadow-[0_10px_24px_rgba(124,194,58,0.22)]" : "border border-line bg-white text-mist hover:border-sage/30 hover:text-paper"
      }`}
    >
      {children}
    </button>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 backdrop-blur-sm">
      <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/45">{label}</div>
      <div className="mt-1 text-2xl font-black tabular tracking-tight text-white">{value}</div>
    </div>
  );
}

function Kpi({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="surface-card px-4 py-4 sm:px-5">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className="mt-2 text-2xl font-bold tabular tracking-tight text-paper sm:text-[1.85rem]">{value}</div>
      <div className="mt-1 text-sm text-mist">{helper}</div>
    </div>
  );
}

function QuickInfo({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Activity;
  title: string;
  text: string;
}) {
  return (
    <div className="surface-card flex gap-3 p-4">
      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sage/12 text-link">
        <Icon size={20} />
      </span>
      <div>
        <p className="text-sm font-semibold text-paper">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-mist">{text}</p>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.15rem] border border-line bg-white px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className="mt-2 text-xl font-bold tracking-tight text-paper">{value}</div>
    </div>
  );
}
