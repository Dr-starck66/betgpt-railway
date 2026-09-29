import { Link } from "@tanstack/react-router";
import { pronoVsStake } from "@/lib/markets";
import { matchPath } from "@/lib/seo";
import { GUIDES, PRONO_LEAGUES, parisDay } from "@/lib/seo/money-map";
import { collectionJsonLd, itemListJsonLd, SITE_URL } from "@/lib/programmatic";
import { breadcrumbJsonLd } from "@/lib/cocon";
import { ld } from "@/lib/ld";
import { fmtOdds, fmtPct } from "@/lib/utils";
import type { LeagueId, MatchInput, PredictionRecord } from "@/engine/types";

export type SiloDesk = {
  matches: MatchInput[];
  predictions: PredictionRecord[];
  engineVersion?: string;
  liveAsOf?: string;
};

export function filterSiloMatches(
  desk: SiloDesk,
  filter: { league?: LeagueId; day?: string },
): { match: MatchInput; prediction: PredictionRecord }[] {
  const byId = new Map(desk.predictions.map((p) => [p.matchId, p]));
  return desk.matches
    .filter((m) => (filter.league ? m.league === filter.league : true))
    .filter((m) => (filter.day ? parisDay(m.kickoff) === filter.day : true))
    .map((match) => {
      const prediction = byId.get(match.id);
      return prediction ? { match, prediction } : null;
    })
    .filter((row): row is { match: MatchInput; prediction: PredictionRecord } => Boolean(row))
    .sort((a, b) => statusRank(a.match) - statusRank(b.match) || Date.parse(a.match.kickoff) - Date.parse(b.match.kickoff))
    .slice(0, 48);
}

function statusRank(match: MatchInput): number {
  if (match.status === "live") return 0;
  if (match.status === "finished") return 2;
  return 1;
}

function issue1x2(match: MatchInput, market: string): string | null {
  if (match.status !== "finished" || match.scoreHome == null || match.scoreAway == null) return null;
  if (market !== "1X2_H" && market !== "1X2_D" && market !== "1X2_A") return null;
  const actual = match.scoreHome > match.scoreAway ? "1X2_H" : match.scoreHome < match.scoreAway ? "1X2_A" : "1X2_D";
  return actual === market ? "1N2 conforme au score" : "1N2 non conforme au score";
}

export function PronoSilo({
  h1,
  lead,
  path,
  crumbs,
  desk,
  filter,
  kind,
}: {
  h1: string;
  lead: string;
  path: string;
  crumbs: { href: string; name: string }[];
  desk: SiloDesk;
  filter: { league?: LeagueId; day?: string };
  kind: "pillar" | "day" | "league" | "football";
}) {
  const rows = filterSiloMatches(desk, filter);
  const listLd = itemListJsonLd(
    h1,
    `${SITE_URL}${path}`,
    rows.slice(0, 20).map(({ match }) => ({
      name: `${match.home.name} – ${match.away.name}`,
      url: `${SITE_URL}${matchPath(match)}`,
    })),
  );
  return (
    <article className="space-y-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld(breadcrumbJsonLd(crumbs)) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld(collectionJsonLd(h1, `${SITE_URL}${path}`, lead)) }} />
      {rows.length ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld(listLd) }} /> : null}
      <nav className="flex flex-wrap gap-2 text-xs" aria-label="Fil d’Ariane">
        {crumbs.map((c) => (
          <Link key={c.href} to={c.href} className="chip-pill min-h-0 py-1 hover:text-link">
            {c.name}
          </Link>
        ))}
      </nav>
      <header className="hero-panel p-6 sm:p-8">
        <p className="eyebrow">Pronostics football</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-5xl">{h1}</h1>
        <p className="mt-4 max-w-4xl text-base leading-relaxed text-mist sm:text-lg">{lead}</p>
        <div className="mt-5 flex flex-wrap gap-2 text-xs text-muted">
          <span className="chip-pill">Football uniquement</span>
          <span className="chip-pill">Probabilités du modèle</span>
          <span className="chip-pill">18+</span>
          <Link to="/jeu-responsable" className="chip-pill hover:text-link">Jeu responsable</Link>
        </div>
        <p className="mt-4 text-xs text-muted">
          Données actualisées {desk.liveAsOf ? new Date(desk.liveAsOf).toLocaleString("fr-FR", { timeZone: "Europe/Paris" }) : "—"}.
          {desk.engineVersion ? ` Moteur ${desk.engineVersion}.` : ""}
        </p>
      </header>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-line bg-surface p-4 text-sm text-mist">
          Aucun match ouvert dans ce filtre pour l’instant. Les fiches ne sont pas remplies avec des rencontres inventées.
        </p>
      ) : (
        <div className="surface-card overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-raised text-[11px] uppercase tracking-wider text-muted">
              <tr>
                <th className="px-3 py-2">Match</th>
                <th className="px-3 py-2">Pronostic</th>
                <th className="px-3 py-2">Modèle</th>
                <th className="px-3 py-2">Cote</th>
                <th className="px-3 py-2">Implicite</th>
                <th className="px-3 py-2">Écart</th>
                <th className="px-3 py-2">Incertitude</th>
                <th className="px-3 py-2">Moteur</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ match, prediction }) => {
                const { prono } = pronoVsStake(prediction.markets);
                const listed = prono.listed && prono.bestOdds >= 1.05;
                const uncertainty = prediction.live?.uncertainty?.find((item) => item.trim()) || "non publiée";
                const issued = issue1x2(match, prono.market);
                const stamped = Date.parse(prediction.timestamp);
                return (
                  <tr key={match.id} className="border-t border-line align-top">
                    <td className="px-3 py-2">
                      <Link to={matchPath(match)} className="font-medium text-paper hover:text-sage">
                        {match.home.short} – {match.away.short}
                      </Link>
                      <div className="text-xs text-muted">
                        Football · {match.competition} ·{" "}
                        {new Date(match.kickoff).toLocaleString("fr-FR", {
                          timeZone: "Europe/Paris",
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {match.status === "finished" && match.scoreHome != null
                          ? ` · ${match.scoreHome}–${match.scoreAway}`
                          : ""}
                      </div>
                      <div className="text-xs text-muted">
                        {Number.isFinite(stamped)
                          ? `Produit ${new Date(stamped).toLocaleString("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`
                          : "Horodatage absent"}
                        {issued ? ` · ${issued}` : ""}
                      </div>
                    </td>
                    <td className="px-3 py-2">{prono.label}</td>
                    <td className="px-3 py-2 tabular">{fmtPct(prono.modelProb)}</td>
                    <td className="px-3 py-2 tabular">{listed ? fmtOdds(prono.bestOdds) : "non listée"}</td>
                    <td className="px-3 py-2 tabular">{listed ? fmtPct(prono.implied) : "—"}</td>
                    <td className="px-3 py-2 tabular">{listed ? fmtPct(prono.edge) : "—"}</td>
                    <td className="px-3 py-2 text-xs">{uncertainty}</td>
                    <td className="px-3 py-2 text-xs">{prediction.engineVersion || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="surface-card p-5 sm:p-6">
          <h2 className="text-sm font-semibold">Compétitions</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {PRONO_LEAGUES.map((l) => (
              <li key={l.slug}>
                <Link to="/pronostics-football/$league" params={{ league: l.slug }} className="text-mist hover:text-paper">
                  Pronostic {l.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="surface-card p-5 sm:p-6">
          <h2 className="text-sm font-semibold">Autres entrées</h2>
          <ul className="mt-2 space-y-1 text-sm">
            <li>
              <Link to="/pronostics-football/aujourdhui" className="text-mist hover:text-paper">
                Pronostics aujourd’hui
              </Link>
            </li>
            <li>
              <Link to="/pronostics-football/demain" className="text-mist hover:text-paper">
                Pronostics demain
              </Link>
            </li>
            <li>
              <Link to="/pronos-football" className="text-mist hover:text-paper">
                Bureau des pronos
              </Link>
            </li>
            <li>
              <Link to="/rapports/precision" className="text-mist hover:text-paper">
                Rapport de précision
              </Link>
            </li>
            <li>
              <Link to="/outils/$slug" params={{ slug: "value-bet" }} className="text-mist hover:text-paper">
                Calculateur d’écart
              </Link>
            </li>
            <li>
              <Link to="/guides" className="text-mist hover:text-paper">
                Guides
              </Link>
            </li>
            {kind === "pillar" || kind === "football"
              ? GUIDES.slice(0, 3).map((g) => (
                  <li key={g.slug}>
                    <Link to="/guides/$slug" params={{ slug: g.slug }} className="text-mist hover:text-paper">
                      {g.h1}
                    </Link>
                  </li>
                ))
              : null}
          </ul>
        </div>
      </section>
      {kind === "pillar" ? (
        <section className="surface-card space-y-3 p-5 text-sm leading-relaxed text-mist sm:p-6">
          <h2 className="text-base font-semibold text-paper">Ce que la ligne permet de vérifier</h2>
          <p>Donnée : probabilité du modèle, pas une intuition signée. Marché : probabilité implicite 1/cote, seulement si la cote est listée. Écart : modèle moins implicite. Le score de confiance interne n’est pas affiché tant qu’il n’est pas une mesure publiable.</p>
          <p>
            Après le match, la fiche garde le score et dit si le 1N2 affiché colle au résultat. Le règlement des mises est le{" "}
            <Link to="/ledger" className="underline">bilan</Link>, pas cette colonne. Export :{" "}
            <a href="/evidence.json" className="underline">evidence.json</a>
            {" · "}
            <a href="/evidence.csv" className="underline">evidence.csv</a>.
          </p>
          <p>BetGPT ne couvre pas le tennis ni le basket, ne classe pas les bookmakers, et ne promet pas une position Google.</p>
        </section>
      ) : null}
      <p className="text-xs text-muted">
        Page {path}. Une cote absente reste absente. Le bilan des lignes enregistrées avant le coup d’envoi est sur{" "}
        <Link to="/ledger" className="underline">
          le registre
        </Link>
        .
      </p>
    </article>
  );
}
