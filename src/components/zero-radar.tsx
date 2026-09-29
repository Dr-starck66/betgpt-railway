import { Crest } from "@/components/crest";
import { FollowStar } from "@/components/follow-star";
import { Methodology } from "@/components/methodology";
import { CoconMesh } from "@/components/cocon-mesh";
import { LEAGUE_SLUG } from "@/engine/stats";
import { fmtPct } from "@/lib/utils";
import type { LeagueId } from "@/engine/types";

const SEASONS = [
  { id: "current", label: "Saison en cours" },
  { id: "prev", label: "Saison précédente" },
  { id: "last-3", label: "3 saisons complètes" },
  { id: "last-5", label: "5 saisons complètes" },
  { id: "all", label: "Toutes" },
] as const;

export function ZeroRadarView({
  title,
  intro,
  sort,
  season,
  seasonLabel,
  leagues,
  teams,
  empty,
  historyN,
  provenance,
  path,
}: {
  title: string;
  intro: string;
  sort: "low" | "high";
  season: string;
  seasonLabel: string;
  leagues: { league: LeagueId; label: string; n: number; n00: number; freq: number; from?: string; to?: string }[];
  teams: {
    id: string;
    name: string;
    n: number;
    n00: number;
    freq: number;
    nHome?: number;
    n00Home?: number;
    nAway?: number;
    n00Away?: number;
  }[];
  empty: boolean;
  historyN: number;
  provenance: { n: number; from: string; to: string; source: string };
  path: string;
}) {
  const other = sort === "low" ? "/statistics/leagues/highest-0-0" : "/statistics/leagues/lowest-0-0";
  return (
    <article className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-sage">Radar 0-0</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="seo-answer mt-2 max-w-3xl text-sm leading-relaxed text-paper">{intro}</p>
      </header>
      <div className="flex flex-wrap gap-2">
        {SEASONS.map((s) => (
          <a
            key={s.id}
            href={`${path}?season=${s.id}`}
            className={`inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium ${
              season === s.id ? "bg-sage text-ink" : "border border-line text-mist"
            }`}
          >
            {s.label}
          </a>
        ))}
      </div>
      {empty ? (
        <p className="rounded-lg border border-line bg-surface p-4 text-sm text-mist">
          Aucun match dans {seasonLabel}. L’archive s’arrête à la dernière saison ESPN disponible. Rien n’est inventé.
        </p>
      ) : null}
      <section>
        <h2 className="text-lg font-semibold">Ligues</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[22rem] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Ligue</th>
                <th className="px-4 py-3 font-medium">Matches</th>
                <th className="px-4 py-3 font-medium">0-0</th>
                <th className="px-4 py-3 font-medium">Fréquence</th>
                <th className="px-4 py-3 font-medium">Couverture</th>
              </tr>
            </thead>
            <tbody>
              {leagues.map((l) => (
                <tr key={l.league} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {l.n < 10 ? (
                        l.label
                      ) : (
                        <a href={`/statistics/${LEAGUE_SLUG[l.league]}/most-common-scores`} className="hover:text-sage">
                          {l.label}
                        </a>
                      )}
                      <FollowStar kind="league" id={l.league} label={l.label} />
                    </div>
                  </td>
                  <td className="px-4 py-3 tabular">{l.n}</td>
                  <td className="px-4 py-3 tabular">{l.n00}</td>
                  <td className="px-4 py-3 tabular">{l.n >= 10 ? fmtPct(l.freq) : "n < 10"}</td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {l.from && l.to ? `${l.from} → ${l.to}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section>
        <h2 className="text-lg font-semibold">Clubs (min. 20 matches)</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[22rem] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Club</th>
                <th className="px-4 py-3 font-medium">Matches</th>
                <th className="px-4 py-3 font-medium">0-0</th>
                <th className="px-4 py-3 font-medium">Fréquence</th>
                <th className="px-4 py-3 font-medium">Domicile</th>
                <th className="px-4 py-3 font-medium">Extérieur</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((t) => (
                <tr key={t.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Crest name={t.name} short={t.name.slice(0, 3)} id={t.id} size={22} />
                      {t.name}
                      <FollowStar kind="team" id={t.name} label={t.name} />
                    </div>
                  </td>
                  <td className="px-4 py-3 tabular">{t.n}</td>
                  <td className="px-4 py-3 tabular">{t.n00}</td>
                  <td className="px-4 py-3 tabular">{fmtPct(t.freq)}</td>
                  <td className="px-4 py-3 tabular text-mist">
                    {t.n00Home != null && t.nHome != null ? `${t.n00Home}/${t.nHome}` : "—"}
                  </td>
                  <td className="px-4 py-3 tabular text-mist">
                    {t.n00Away != null && t.nAway != null ? `${t.n00Away}/${t.nAway}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <p className="text-sm">
        <a href={`${other}?season=${season}`} className="text-sage">
          {sort === "low" ? "Voir les plus de 0-0" : "Voir les moins de 0-0"}
        </a>
      </p>
      <Methodology
        n={historyN}
        extra={`${seasonLabel}. n filtré=${provenance.n}. ${provenance.source}. Clubs sous 20 matches exclus.`}
      />
      <CoconMesh
        crumbs={[
          { name: "BetGPT", href: "/" },
          { name: "Statistiques", href: "/statistics" },
          { name: title, href: path },
        ]}
        parent={{ href: "/statistics", anchor: "Statistiques football", rel: "parent" }}
        sisters={[
          { href: "/statistics/most-common-scores", anchor: "Scores fréquents", rel: "sister" },
          { href: other, anchor: sort === "low" ? "Plus de 0-0" : "Moins de 0-0", rel: "sister" },
          { href: "/score-hunter/0-0", anchor: "0-0 Hunter", rel: "sister" },
        ]}
        children={[{ href: "/score-hunter/low-0-0", anchor: "Faible 0-0 Hunter", rel: "child" }]}
      />
    </article>
  );
}
