import { createFileRoute } from "@tanstack/react-router";
import { getSocialAdmin } from "@/lib/social.functions";

export const Route = createFileRoute("/admin_/social")({
  loader: () => getSocialAdmin(),
  head: () => ({
    meta: [
      { title: "ASTRA SOCIAL — interne" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "googlebot", content: "noindex, nofollow" },
    ],
  }),
  component: SocialAdmin,
});

function SocialAdmin() {
  const data = Route.useLoaderData();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-link">ASTRA SOCIAL</p>
        <h1 className="mt-1 font-display text-2xl tracking-tight">Publication sociale autonome</h1>
        <p className="mt-2 text-sm text-mist">
          X · {data.provider.state} · auto-publication {data.provider.autoPublish ? "active" : "désactivée"} · {data.provider.reason}
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        {Object.entries(data.counts).map(([status, count]) => (
          <div key={status} className="surface-card p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-mist">{status}</p>
            <p className="mt-1 text-2xl font-semibold text-paper">{count}</p>
          </div>
        ))}
        {Object.keys(data.counts).length === 0 ? (
          <p className="text-sm text-mist">Aucun article récent n’a encore généré de job social.</p>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">File X</h2>
        {data.rows.length ? (
          <ul className="space-y-3">
            {data.rows.map((row) => (
              <li key={row.id} className="surface-card p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-paper">{row.articleTitle}</p>
                  <span className="rounded-full border border-line px-2 py-1 text-xs text-mist">{row.status}</span>
                </div>
                <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed text-mist">{row.text}</pre>
                <div className="mt-3 flex flex-wrap gap-3 text-xs">
                  <a href={row.articleUrl} className="text-link" target="_blank" rel="noreferrer">Article</a>
                  {row.remotePostUrl ? (
                    <a href={row.remotePostUrl} className="text-link" target="_blank" rel="noreferrer">Post publié</a>
                  ) : (
                    <a href={row.intentUrl} className="text-link" target="_blank" rel="noreferrer">Ouvrir dans X</a>
                  )}
                  <span className="text-mist">retries {row.retryCount}</span>
                  {row.error ? <span className="text-red-300">{row.error}</span> : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-mist">La file est vide.</p>
        )}
      </section>
    </div>
  );
}
