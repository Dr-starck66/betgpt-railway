import { Link } from "@tanstack/react-router";
import { LEAGUE_HUBS } from "@/lib/programmatic";

export function MatchMissing({ id }: { id?: string }) {
  return (
    <section className="mx-auto max-w-2xl space-y-6 py-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-sage">Dossier match</p>
        <h1 className="text-2xl font-semibold tracking-tight">Ce match n’est pas dans le bureau actuel</h1>
        <p className="text-sm text-paper">
          L’URL ne correspond pas à une affiche live, ni à un match archivé BetGPT. Le bilan, les scores en
          direct et les pronos du jour restent accessibles — on n’affiche jamais une page morte.
        </p>
        {id ? <p className="text-xs text-muted">Référence : {id}</p> : null}
      </header>
      <nav className="grid gap-3 sm:grid-cols-2">
        <Link
          to="/scores-en-direct"
          className="rounded-xl border border-line bg-surface px-4 py-3 text-sm hover:border-sage"
        >
          Scores en direct
        </Link>
        <Link
          to="/pronos-football"
          className="rounded-xl border border-line bg-surface px-4 py-3 text-sm hover:border-sage"
        >
          Pronos football
        </Link>
        <Link to="/ledger" className="rounded-xl border border-line bg-surface px-4 py-3 text-sm hover:border-sage">
          Bilan vérifié
        </Link>
        <Link
          to="/score-hunter"
          className="rounded-xl border border-line bg-surface px-4 py-3 text-sm hover:border-sage"
        >
          Score Hunter
        </Link>
      </nav>
      <div>
        <p className="mb-2 text-xs uppercase tracking-wider text-muted">Compétitions</p>
        <ul className="flex flex-wrap gap-2">
          {LEAGUE_HUBS.map((h) => (
            <li key={h.path}>
              <a href={h.path} className="rounded-full border border-line px-3 py-1 text-xs hover:border-sage">
                {h.title}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}