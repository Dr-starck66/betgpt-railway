import { createFileRoute, Link } from "@tanstack/react-router";
import { getPublicDesk } from "@/lib/desk.functions";
import { CITE_LEAGUES } from "@/engine/cite-public";
import { SITE_URL } from "@/lib/programmatic";
import { CoconMesh } from "@/components/cocon-mesh";
import { COCON_MERES } from "@/lib/cocon";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export const Route = createFileRoute("/calendrier/")({
  loader: () => getPublicDesk(),
  head: () => ({ meta: [{ title: "Calendrier football : prochains matchs Ligue 1, C1, Europa | BetGPT" }, { name: "description", content: "Calendrier football : date, heure et lieu des prochains matchs. Ligue 1, Premier League, Ligue des champions, Ligue Europa. BetGPT, betgpt.live." }], links: [{ rel: "canonical", href: `${SITE_URL}/calendrier` }] }),
  component: CalHub,
});

function CalHub() {
  const data = Route.useLoaderData();
  const n = data.matches.length;
  return (
    <div className="space-y-8">
      <header className="hero-panel p-6 sm:p-8">
        <p className="eyebrow">Calendrier</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-5xl">Calendrier football</h1>
        <p className="seo-answer mt-4 max-w-3xl text-base leading-relaxed text-mist sm:text-lg">{n} prochains matchs suivis, avec horaires Europe/Paris et accès direct à chaque fiche match.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {CITE_LEAGUES.map((l) => <Link key={l.slug} to="/calendrier/$slug" params={{ slug: l.slug }} className="chip-pill hover:text-link">{l.title}</Link>)}
        </div>
      </header>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {CITE_LEAGUES.map((l) => {
          const c = data.matches.filter((m) => m.league === l.league).length;
          return <li key={l.slug} className="surface-card p-5"><Link to="/calendrier/$slug" params={{ slug: l.slug }}><p className="eyebrow">Compétition</p><h2 className="mt-1 text-lg font-semibold">Calendrier {l.title}</h2><p className="mt-2 text-sm text-mist">{c} matchs à l'affiche.</p></Link></li>;
        })}
      </ul>
      <section className="space-y-4">
        <div><p className="eyebrow">À venir</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">Prochains coups d’envoi</h2></div>
        <div className="surface-card overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm"><thead className="bg-slate-50/90 text-left text-[11px] font-semibold uppercase tracking-wider text-muted"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Match</th><th className="px-4 py-3">Compétition</th></tr></thead><tbody>{data.matches.slice().sort((a,b)=>a.kickoff.localeCompare(b.kickoff)).map((m)=><tr key={m.id} className="border-t border-line transition-colors hover:bg-slate-50/70"><td className="px-4 py-4"><time dateTime={m.kickoff}>{format(new Date(m.kickoff), "EEE d MMM HH:mm", { locale: fr })}</time></td><td className="px-4 py-4"><Link to="/match/$matchId" params={{ matchId: m.slug ?? m.id }} className="font-semibold hover:text-link">{m.home.name} – {m.away.name}</Link></td><td className="px-4 py-4 text-mist">{m.competition}</td></tr>)}</tbody></table></div></div>
      </section>
      <CoconMesh crumbs={[{ name: "BetGPT", href: "/" }, { name: "Calendrier", href: "/calendrier" }]} parent={{ href: "/", anchor: "Accueil BetGPT", rel: "parent" }} sisters={COCON_MERES.filter((m) => m.path !== "/calendrier").map((m) => ({ href: m.path, anchor: m.title, rel: "sister" as const }))} children={CITE_LEAGUES.map((l) => ({ href: `/calendrier/${l.slug}`, anchor: `Calendrier ${l.title}`, rel: "child" as const }))} />
    </div>
  );
}
