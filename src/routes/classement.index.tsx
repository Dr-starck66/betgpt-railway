import { createFileRoute, Link } from "@tanstack/react-router";
import { classementAnswer } from "@/engine/cite-public";
import { loadCite } from "@/lib/cite.functions";
import { SITE_URL } from "@/lib/programmatic";
import { ld } from "@/lib/ld";
import { CoconMesh } from "@/components/cocon-mesh";
import { COCON_MERES } from "@/lib/cocon";

export const Route = createFileRoute("/classement/")({
  loader: () => loadCite(),
  head: ({ loaderData }) => {
    const desc = loaderData?.leagues.map((l) => classementAnswer(l.title, l.rows)).slice(0, 2).join(" ") ?? "Classements football en direct.";
    return { meta: [{ title: "Classement football : Ligue 1, Premier League, C1 | BetGPT" }, { name: "description", content: desc }, { property: "og:url", content: `${SITE_URL}/classement` }], links: [{ rel: "canonical", href: `${SITE_URL}/classement` }] };
  },
  component: ClassementHub,
});

function ClassementHub() {
  const data = Route.useLoaderData();
  return (
    <div className="space-y-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld({ "@context": "https://schema.org", "@type": "CollectionPage", name: "Classement football", url: `${SITE_URL}/classement`, description: "Classements Ligue 1, Premier League, Liga, Bundesliga, Serie A, C1, Ligue Europa.", publisher: { "@type": "NewsMediaOrganization", name: "BetGPT", url: SITE_URL } }) }} />
      <header className="hero-panel p-6 sm:p-8">
        <p className="eyebrow">Classements</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-5xl">Classement football</h1>
        <p className="seo-answer mt-4 max-w-4xl text-base leading-relaxed text-mist sm:text-lg">Retrouvez les classements officiels des principales compétitions suivies par BetGPT, avec accès direct au calendrier et aux pronostics associés.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link to="/calendrier" className="chip-pill hover:text-link">Calendrier</Link>
          <Link to="/pronos-football" className="chip-pill hover:text-link">Pronostics</Link>
          {data.leagues.slice(0, 5).map((l) => <Link key={l.slug} to="/classement/$slug" params={{ slug: l.slug }} className="chip-pill hover:text-link">{l.title}</Link>)}
        </div>
      </header>
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.leagues.map((l) => (
          <li key={l.slug} className="surface-card p-5 sm:p-6">
            <Link to="/classement/$slug" params={{ slug: l.slug }}>
              <p className="eyebrow">Compétition</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">Classement {l.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-mist">{classementAnswer(l.title, l.rows)}</p>
              <span className="mt-4 inline-flex text-sm font-semibold text-link">Voir le classement →</span>
            </Link>
          </li>
        ))}
      </ul>
      <CoconMesh crumbs={[{ name: "BetGPT", href: "/" }, { name: "Classements", href: "/classement" }]} parent={{ href: "/", anchor: "Accueil BetGPT", rel: "parent" }} sisters={COCON_MERES.filter((m) => m.path !== "/classement").map((m) => ({ href: m.path, anchor: m.title, rel: "sister" as const }))} children={data.leagues.map((l) => ({ href: `/classement/${l.slug}`, anchor: `Classement ${l.title}`, rel: "child" as const }))} />
    </div>
  );
}
