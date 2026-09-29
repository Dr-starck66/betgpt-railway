import { ecosystemCarousel, SEARCH_INTENT, SERP_OPPORTUNITIES } from "@/lib/serp/carousel";

export function SportsSerpPanel() {
  const carousel = ecosystemCarousel();
  return (
    <div className="mt-10 space-y-8">
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Ecosystem Carousel Readiness</h2>
        <p className="text-sm text-mist">
          Préparation interne : {carousel.readiness}. Décision Google : {carousel.googleDecision}. {carousel.note}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-muted">
                <th className="py-2 pr-3">Critère</th>
                <th className="py-2 pr-3">Code</th>
                <th className="py-2">Preuve</th>
              </tr>
            </thead>
            <tbody>
              {carousel.items.map((item) => (
                <tr key={item.id} className="border-t border-line align-top">
                  <td className="py-2 pr-3 font-semibold text-paper">{item.id}</td>
                  <td className="py-2 pr-3">{item.ok ? "ok" : "gap"}</td>
                  <td className="py-2 text-mist">{item.evidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Sport SERP opportunities</h2>
        <p className="text-sm text-mist">Aucune impression Search Console n’est inventée.</p>
        <ul className="space-y-2 text-sm text-mist">
          {SERP_OPPORTUNITIES.map((row) => (
            <li key={row.family}>
              <span className="font-semibold text-paper">{row.family}</span> ({row.queries}) — {row.status}. {row.missing}
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Search intent map</h2>
        <ul className="space-y-1 text-sm">
          {SEARCH_INTENT.map((row) => (
            <li key={row.query}>
              <span className="text-paper">{row.query}</span> → <span className="text-sage">{row.path}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted">
          VideoObject et badge LIVE : SCHEMA_VALID seulement si une vraie vidéo est embarquée. Éligibilité Google : GOOGLE_ELIGIBILITY_UNVERIFIED. Le catalogue vidéo curaté est vide tant qu’aucun ID YouTube vérifié n’est enregistré.
        </p>
      </section>
    </div>
  );
}
