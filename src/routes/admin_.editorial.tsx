import { createFileRoute } from "@tanstack/react-router";
import { getEditorialAdmin } from "@/lib/editorial.functions";
import { formatParis } from "@/lib/editorial/time";

export const Route = createFileRoute("/admin_/editorial")({
  loader: () => getEditorialAdmin(),
  head: () => ({
    meta: [
      { title: "Éditorial — interne" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "googlebot", content: "noindex, nofollow" },
    ],
  }),
  component: EditorialAdmin,
});

function EditorialAdmin() {
  const data = Route.useLoaderData();
  const { edition } = data;
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl tracking-tight">Éditorial</h1>
      <p className="text-sm text-mist">
        {edition.parisDate} · Europe/Paris · prochaine exécution {formatParis(edition.nextRun)} · planification{" "}
        {formatParis(edition.nextPlanningAt)} · objectif {edition.plannedCount}/3 · {edition.targetStatus} · journal {data.ledgerPersisted ? "persisté" : "mémoire seulement (stockage durable indisponible)"}
      </p>
      <section>
        <h2 className="text-lg font-semibold">Créneaux</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {edition.slots.map((slot) => (
            <li key={slot.id} className="rounded-md border border-line p-3">
              <p className="font-semibold">
                {slot.time} · {slot.jobId} · {slot.article?.status ?? "SKIPPED"}
              </p>
              <p>{slot.article?.h1 ?? slot.skipped?.reason}</p>
              {slot.article ? (
                <p className="text-mist">
                  score sujet {slot.article.newsworthiness} · Discover Opportunity {slot.article.discoverOpportunity.total}/100 · {slot.article.discoverOpportunity.decision} · readiness technique {slot.article.discoverReadiness} · {slot.article.topStories} · sources{" "}
                  {slot.article.sources.map((source) => `${source.label} ${source.status}`).join(" · ")}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="text-lg font-semibold">Candidats</h2>
        <ul className="mt-2 space-y-1 text-sm text-mist">
          {edition.candidates.map((candidate) => (
            <li key={candidate.id}>
              {candidate.score} · {candidate.articleType} · {candidate.title} · {candidate.sources.join(", ")}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="text-lg font-semibold">Sautés</h2>
        {edition.skipped.length ? (
          <ul className="mt-2 text-sm text-mist">
            {edition.skipped.map((row) => (
              <li key={row.jobId}>
                {row.slot} · {row.reason}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-mist">Aucun créneau sauté.</p>
        )}
      </section>
      <section className="overflow-x-auto">
        <h2 className="text-lg font-semibold">Performance</h2>
        <table className="mt-2 min-w-full text-left text-xs">
          <thead>
            <tr className="text-mist">
              <th className="py-1 pr-3">Article</th>
              <th className="py-1 pr-3">Slot</th>
              <th className="py-1 pr-3">Search</th>
              <th className="py-1 pr-3">Discover</th>
              <th className="py-1">Sessions</th>
            </tr>
          </thead>
          <tbody>
            {data.performance.map((row) => (
              <tr key={row.articleId} className="border-t border-line">
                <td className="py-1 pr-3">{row.topic}</td>
                <td className="py-1 pr-3">{row.slot}</td>
                <td className="py-1 pr-3">{row.searchImpressions}</td>
                <td className="py-1 pr-3">{row.discoverClicks}</td>
                <td className="py-1">{row.organicSessions}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.performance.length === 0 ? <p className="text-sm text-mist">Pas encore d'article publié. Mesures : UNKNOWN.</p> : null}
      </section>
    </div>
  );
}
