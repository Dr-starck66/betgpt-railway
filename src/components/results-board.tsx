import { Link } from "@tanstack/react-router";
import { SERP_COMPETITIONS } from "@/lib/serp/leagues";
import { parisTime } from "@/lib/serp/answer";
import type { ResultRow } from "@/lib/serp/results";
import { TeamLine } from "@/components/crest";

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

function Table({ rows, caption }: { rows: ResultRow[]; caption: string }) {
  if (!rows.length) {
    return <div className="surface-card p-5 text-sm text-mist">Aucun résultat enregistré pour cette période.</div>;
  }
  return (
    <div className="surface-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-slate-50/90 text-xs uppercase tracking-[0.14em] text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Heure</th>
              <th className="px-4 py-3 font-semibold">Match</th>
              <th className="px-4 py-3 font-semibold">Score</th>
              <th className="px-4 py-3 font-semibold">Statut</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.slug} className="border-t border-line transition-colors hover:bg-slate-50/70">
                <td className="px-4 py-4 tabular text-mist">{parisTime(row.kickoff) || "—"}</td>
                <td className="px-4 py-4">
                  <Link to="/match/$matchId" params={{ matchId: row.slug }} className="block font-semibold text-paper hover:text-link">
                    <TeamLine
                      home={{ name: row.home, short: row.homeShort, id: row.homeId, logo: row.homeLogo }}
                      away={{ name: row.away, short: row.awayShort, id: row.awayId, logo: row.awayLogo }}
                      size={30}
                      names="full"
                      competition={row.competition}
                    />
                  </Link>
                  <span className="mt-1 block text-xs text-muted">{row.competition}</span>
                </td>
                <td className="px-4 py-4 text-xl font-bold tabular tracking-tight text-paper">
                  {row.scoreHome}–{row.scoreAway}
                </td>
                <td className="px-4 py-4">
                  <span className="chip-pill min-h-0 py-1">Terminé</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ResultsBoard({
  h1,
  lead,
  sections,
}: {
  h1: string;
  lead: string;
  sections: { id: string; title: string; rows: ResultRow[] }[];
}) {
  return (
    <div className="space-y-8">
      <header className="hero-panel p-6 sm:p-8">
        <p className="eyebrow">Résultats football</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-paper sm:text-4xl">{h1}</h1>
        <p className="seo-answer mt-4 max-w-3xl text-base leading-relaxed text-mist sm:text-lg">{lead}</p>
        <nav aria-label="Résultats par compétition" className="mt-5 flex flex-wrap gap-2 text-sm">
          <a href="/scores-en-direct" className="chip-pill hover:border-sage/30 hover:text-link">Scores en direct</a>
          <a href="/resultats-football" className="chip-pill hover:border-sage/30 hover:text-link">Tous les résultats</a>
          <a href="/resultats-football/aujourdhui" className="chip-pill hover:border-sage/30 hover:text-link">Aujourd’hui</a>
          <a href="/resultats-football/hier" className="chip-pill hover:border-sage/30 hover:text-link">Hier</a>
          {SERP_COMPETITIONS.map((c) => (
            <a key={c.slug} href={c.resultsPath} className="chip-pill hover:border-sage/30 hover:text-link">{c.title}</a>
          ))}
        </nav>
      </header>

      {sections.map((section) => (
        <section key={section.id} className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Résultats vérifiés</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-paper">{section.title}</h2>
            </div>
            <span className="chip-pill">{section.rows.length} match{section.rows.length > 1 ? "s" : ""}</span>
          </div>
          <Table rows={section.rows} caption={section.title} />
        </section>
      ))}
    </div>
  );
}

export function resultsLead(rows: ResultRow[], label: string): string {
  if (!rows.length) return `Aucun résultat football ${label} n’est enregistré dans le bureau BetGPT.`;
  const bits = rows.slice(0, 4).map((r) => `${r.home} ${r.scoreHome}–${r.scoreAway} ${r.away}`);
  return `Résultats football ${label} : ${bits.join(" · ")}.`;
}

export function dayTitle(day: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return "Date précédente";
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}
