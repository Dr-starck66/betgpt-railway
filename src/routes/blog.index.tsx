import { createFileRoute, Link } from "@tanstack/react-router";
import { CoconMesh } from "@/components/cocon-mesh";
import { SeoImg } from "@/components/seo-img";
import { BLOG } from "@/lib/blog";
import { blogCover } from "@/lib/blog-rich";
import { blogHubLd } from "@/lib/blog-ld";
import { BRAND_OG, imageHeadTags } from "@/lib/image-seo";
import { COCON_MERES, COCON_PILIERS } from "@/lib/cocon";
import { ld } from "@/lib/ld";
import { SITE_URL } from "@/lib/programmatic";

export const Route = createFileRoute("/blog/")({
  head: () => ({ meta: [{ title: "Blog football : pronostics, cotes, scores live | BetGPT" }, { name: "description", content: "Blog BetGPT : pronostic football aujourd’hui, meilleures cotes France, value bet, score en direct Ligue 1, C1, Europa. 18+." }, { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1" }, { property: "og:url", content: `${SITE_URL}/blog` }, ...imageHeadTags(BRAND_OG)], links: [{ rel: "canonical", href: `${SITE_URL}/blog` }] }),
  component: BlogHub,
});

function BlogHub() {
  const [featured, ...rest] = BLOG;
  return (
    <div className="space-y-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld(blogHubLd()) }} />
      <header className="hero-panel p-6 sm:p-8"><p className="eyebrow">Guides & analyses</p><h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-5xl">Blog football BetGPT</h1><p className="mt-4 max-w-3xl text-base leading-relaxed text-mist sm:text-lg">Analyses, méthodes, value bet, xG et lecture des marchés pour comprendre les données derrière les pronostics. 18+.</p></header>
      {featured ? <Link to="/blog/$slug" params={{ slug: featured.slug }} className="section-card grid overflow-hidden lg:grid-cols-[1.1fr_.9fr]"><div className="p-6 sm:p-8"><p className="eyebrow">{featured.section}</p><h2 className="mt-2 text-3xl font-bold tracking-tight">{featured.h1}</h2><p className="mt-4 text-base leading-relaxed text-mist">{featured.lead}</p><span className="mt-5 inline-flex text-sm font-semibold text-link">Lire le guide →</span></div><SeoImg seo={blogCover(featured)} width={1200} height={675} className="h-full min-h-[260px] w-full object-cover" /></Link> : null}
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{rest.map((a)=>{const cover=blogCover(a);return <li key={a.slug}><Link to="/blog/$slug" params={{slug:a.slug}} className="surface-card block h-full overflow-hidden"><SeoImg seo={cover} width={1200} height={675} className="aspect-[16/10] w-full object-cover"/><div className="p-5"><p className="eyebrow">{a.section}</p><h2 className="mt-2 text-xl font-semibold tracking-tight">{a.h1}</h2><p className="mt-2 line-clamp-3 text-sm leading-relaxed text-mist">{a.lead}</p></div></Link></li>})}</ul>
      <CoconMesh crumbs={[{ name: "BetGPT", href: "/" }, { name: "Blog", href: "/blog" }]} parent={{ href: "/actu", anchor: "Fil actu", rel: "parent" }} sisters={[...COCON_MERES.filter((m) => m.path !== "/blog").map((m) => ({ href: m.path, anchor: m.title, rel: "sister" as const })), ...COCON_PILIERS.map((p) => ({ href: p.path, anchor: p.title, rel: "sister" as const }))]} children={BLOG.map((a) => ({ href: `/blog/${a.slug}`, anchor: a.h1, rel: "child" as const }))} />
    </div>
  );
}
