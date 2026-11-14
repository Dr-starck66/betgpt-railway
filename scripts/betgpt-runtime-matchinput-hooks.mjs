/**
 * Standalone read-only BetGPT live.ts import.
 * Stub for cosmetic SEO matchSlug only; all MatchInput construction,
 * sources, profiles and data parsing use original BetGPT code unchanged.
 */
const seoStub="export function matchSlug(match){\n  const slugify=s=>s.toLowerCase().normalize(\"NFD\")\n    .replace(/[\\u0300-\\u036f]/g,\"\").replace(/[^a-z0-9]+/g,\"-\")\n    .replace(/^-|-$/g,\"\").slice(0,48);\n  return slugify(match.home.name)+\"-\"+slugify(match.away.name)+\"-\"+match.kickoff.slice(0,10);\n}";
export async function resolve(specifier, context, nextResolve) {
 if(specifier==="@/lib/seo" && context.parentURL?.endsWith("/src/engine/live.ts"))
   return {url:"data:text/javascript,"+encodeURIComponent(seoStub),shortCircuit:true};
 return nextResolve(specifier,context);
}
