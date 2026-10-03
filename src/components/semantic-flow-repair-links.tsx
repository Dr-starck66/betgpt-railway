import { SEMANTIC_AUTO_LINKS } from "@/lib/seo/semantic-auto-links.generated";

function routeMatches(pattern: string, pathname: string): boolean {
  if (pattern === pathname) return true;
  const p = pattern.split("/").filter(Boolean);
  const a = pathname.split("/").filter(Boolean);
  if (p.length !== a.length) return false;
  return p.every((segment, index) => segment.startsWith(":") || segment === a[index]);
}

export function SemanticFlowRepairLinks({ pathname }: { pathname: string }) {
  const links = SEMANTIC_AUTO_LINKS
    .filter((link) => routeMatches(link.source, pathname))
    .filter((link, index, all) => all.findIndex((x) => x.href === link.href) === index)
    .slice(0, 4);

  if (!links.length) return null;

  return (
    <aside
      aria-label="Navigation contextuelle recommandée"
      className="mt-8 rounded-[1.25rem] border border-line bg-white/70 p-5"
      data-astra-semantic-autorepair="true"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">À explorer ensuite</p>
      <ul className="mt-3 flex flex-wrap gap-2 text-sm">
        {links.map((link) => (
          <li key={link.href}>
            <a
              href={link.href}
              className="chip-pill hover:border-sage/30 hover:text-link"
              data-semantic-reason={link.reason}
            >
              {link.anchor}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
