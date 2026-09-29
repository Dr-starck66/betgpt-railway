import { type CoconLink } from "@/lib/cocon";

export function CoconMesh({
  crumbs,
  parent,
  sisters,
  children,
}: {
  crumbs: { name: string; href: string }[];
  parent: CoconLink;
  sisters: CoconLink[];
  children: CoconLink[];
}) {
  const seen = new Set<string>();
  const uniq = (xs: CoconLink[]) =>
    xs.filter((x) => {
      if (seen.has(x.href)) return false;
      seen.add(x.href);
      return true;
    });
  const up = uniq([parent]);
  const side = uniq(sisters).slice(0, 10);
  const down = uniq(children).slice(0, 14);
  return (
    <nav aria-label="Cocon sémantique" className="space-y-4 text-sm">
      <ol className="flex flex-wrap gap-x-2 gap-y-1 text-mist">
        {crumbs.map((c, i) => (
          <li key={`${c.href}-${i}`} className="flex items-center gap-2">
            {i > 0 ? <span className="text-muted">/</span> : null}
            {i === crumbs.length - 1 ? (
              <span className="text-paper">{c.name}</span>
            ) : (
              <a href={c.href} title={c.name} className="hover:text-sage">
                {c.name}
              </a>
            )}
          </li>
        ))}
      </ol>
      <div className="grid gap-4 sm:grid-cols-3">
        <MeshCol title="Page mère" links={up} />
        <MeshCol title="Pages sœurs" links={side} />
        <MeshCol title="Pages filles" links={down} />
      </div>
    </nav>
  );
}

function MeshCol({ title, links }: { title: string; links: CoconLink[] }) {
  if (!links.length) return null;
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{title}</p>
      <ul className="mt-2 space-y-1">
        {links.map((l) => (
          <li key={l.href}>
            <a href={l.href} title={l.anchor} className="text-mist hover:text-sage">
              {l.anchor}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
