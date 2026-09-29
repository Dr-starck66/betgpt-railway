import { Link } from "@tanstack/react-router";

export function LatestNews({
  published,
  planned,
}: {
  published: { href: string; title: string; lead: string; time: string; category: string; image: string; alt: string }[];
  planned: { slot: string; time: string; title: string; score: number | null; status: string; sources: string[] }[];
}) {
  const [featured, ...rest] = published;
  const secondary = rest.slice(0, 2);

  return (
    <section className="space-y-5" aria-label="Dernières actualités">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Actualités football</p>
          <h2 className="mt-1 font-display text-2xl tracking-tight sm:text-[2rem]">Les sujets forts du moment</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-mist">
            BetGPT sélectionne les sujets les plus utiles pour un public football en France : zéro remplissage, uniquement des articles qui méritent d’être lus.
          </p>
        </div>
        <Link to="/actualites" className="cta-secondary self-start sm:self-auto">
          Toutes les actualités
        </Link>
      </div>

      {published.length ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">
          <a href={featured.href} className="group section-card overflow-hidden">
            <div className="grid h-full lg:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)]">
              <div className="min-w-0 p-5 sm:p-7">
                <div className="flex flex-wrap gap-2">
                  <span className="chip-pill border-sage/25 bg-sage/10 text-link">{featured.category}</span>
                  <span className="chip-pill">{featured.time}</span>
                </div>
                <h3 className="mt-4 text-2xl font-bold leading-tight tracking-tight text-paper transition-colors group-hover:text-link sm:text-[2rem]">
                  {featured.title}
                </h3>
                <p className="mt-4 readable-prose text-[0.98rem]">{featured.lead}</p>
                <div className="mt-5 inline-flex items-center text-sm font-semibold text-link">
                  Lire l’article →
                </div>
              </div>
              <div className="min-h-[230px] bg-slate-100 lg:min-h-full">
                <img
                  src={featured.image}
                  alt={featured.alt}
                  width={1200}
                  height={675}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
            </div>
          </a>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            {secondary.map((item) => (
              <a key={item.href} href={item.href} className="group surface-card overflow-hidden">
                <img
                  src={item.image}
                  alt={item.alt}
                  width={1200}
                  height={675}
                  className="aspect-[16/10] w-full object-cover"
                  loading="lazy"
                />
                <div className="space-y-2 p-4 sm:p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-link">
                    {item.category} · {item.time}
                  </p>
                  <p className="text-lg font-bold leading-snug tracking-tight text-paper transition-colors group-hover:text-link">
                    {item.title}
                  </p>
                  <p className="line-clamp-3 text-sm leading-relaxed text-mist">{item.lead}</p>
                </div>
              </a>
            ))}

            <div className="surface-card p-5">
              <h3 className="text-sm font-semibold text-paper">Ligne éditoriale du jour</h3>
              <ul className="mt-3 space-y-3 text-sm leading-relaxed text-mist">
                <li>• 3 publications ciblées par jour, chacune devant franchir le filtre qualité.</li>
                <li>• Priorité aux sujets forts, récents et pertinents pour la France ; si un candidat échoue, un remplaçant est recherché.</li>
                <li>• Pas de programme du jour générique, pas de remplissage automatique.</li>
              </ul>
              {planned.length ? (
                <div className="mt-4 border-t border-line pt-4 text-xs text-muted">
                  Fenêtres de veille : {planned.map((item) => item.time).join(" · ")}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <div className="surface-card p-6 text-sm text-mist">
          Aucun article publié pour l'instant. Le moteur éditorial préfère sauter un créneau plutôt que publier un contenu faible.
        </div>
      )}
    </section>
  );
}
