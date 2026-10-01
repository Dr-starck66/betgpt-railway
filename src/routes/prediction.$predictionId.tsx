import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { getEvidence } from "@/lib/desk.functions";
import { SITE_URL } from "@/lib/seo";
import { fmtOdds, fmtPct } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Crest } from "@/components/crest";
import { AstraSidewings } from "@/components/astra-sidewings";
import { ld } from "@/lib/ld";

export const Route = createFileRoute("/prediction/$predictionId")({
  loader: async ({ params }) => {
    const data = await getEvidence({ data: { id: params.predictionId } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData, params }) => {
    const row = loaderData?.row;
    const title = row
      ? `Vérification · ${row.home} – ${row.away} | BetGPT`
      : "Vérification pronostic | BetGPT";
    return {
      meta: [
        { title },
        {
          name: "description",
          content: row
            ? `Pronostic horodaté ${row.label} · ${fmtOdds(row.odds)}. Conservé même s'il perd. Pas une certitude. 18+.`
            : "Registre public des pronostics BetGPT.",
        },
        { name: "robots", content: "index, follow" },
      ],
      links: [{ rel: "canonical", href: `${SITE_URL}/prediction/${params.predictionId}` }],
      scripts: row
        ? [
            {
              type: "application/ld+json",
              children: ld(predictionEvidenceLd(row, params.predictionId, title)),
            },
          ]
        : [],
    };
  },
  component: PredictionPage,
  notFoundComponent: () => <p className="text-muted">Pronostic introuvable.</p>,
});

function predictionEvidenceLd(
  row: {
    id: string;
    matchId: string;
    home: string;
    away: string;
    kickoff: string;
    recordedAt: string;
    label: string;
    result?: "win" | "lose" | "void";
  },
  predictionId: string,
  title: string,
): object {
  const url = `${SITE_URL}/prediction/${predictionId}`;
  const eventId = `${SITE_URL}/match/${encodeURIComponent(row.matchId)}#event`;
  const description = `Pronostic horodaté ${row.label} pour ${row.home} – ${row.away}. Registre public BetGPT conservé avant et après le résultat.`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: title,
        description,
        datePublished: row.recordedAt,
        inLanguage: "fr-FR",
        isPartOf: { "@id": `${SITE_URL}/#website` },
        about: { "@id": eventId },
      },
      {
        "@type": "SportsEvent",
        "@id": eventId,
        name: `${row.home} vs ${row.away}`,
        startDate: row.kickoff,
        sport: "Soccer",
        homeTeam: { "@type": "SportsTeam", name: row.home },
        awayTeam: { "@type": "SportsTeam", name: row.away },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Accueil", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Bilan BetGPT", item: `${SITE_URL}/ledger` },
          { "@type": "ListItem", position: 3, name: `${row.home} – ${row.away}`, item: url },
        ],
      },
    ],
  };
}

function utc(iso: string) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  return `${format(new Date(t), "d MMM yyyy · HH:mm", { locale: fr })} UTC`;
}

function PredictionPage() {
  const { row, status, statusLabel, lifecycleLabel, beforeKickoff, minutes, events, integrity } = Route.useLoaderData();
  const matchHref = `/match/${encodeURIComponent(row.matchId)}`;
  const oddsText = `${fmtOdds(row.odds)} · ${row.book}`;
  const timingText =
    minutes == null
      ? "Horodatage relatif indisponible"
      : minutes >= 0
        ? `Publié ${minutes} min avant le coup d'envoi`
        : `Publié ${Math.abs(minutes)} min après le coup d'envoi`;

  const leftWing = {
    eyebrow: "Explorer",
    title: `Autour de ${row.home} – ${row.away}`,
    intro: "Continue l’analyse sans revenir au menu principal : match, cotes, autres pronostics et scores.",
    links: [
      {
        href: matchHref,
        label: "Ouvrir la fiche du match",
        description: `Contexte et informations disponibles pour ${row.home} – ${row.away}.`,
        eyebrow: "Match",
      },
      {
        href: "/comparer-cotes",
        label: "Comparer les cotes",
        description: "Passer du pronostic aux prix disponibles et à leur comparaison.",
        eyebrow: "Cotes",
      },
      {
        href: "/pronostics-sportifs",
        label: "Voir les autres pronostics",
        description: "Revenir au hub des sélections et analyses football.",
        eyebrow: "Pronostics",
      },
      {
        href: "/scores-en-direct",
        label: "Suivre les scores",
        description: "Accéder aux rencontres en direct et à leur état de jeu.",
        eyebrow: "Live",
      },
    ],
  };

  const rightWing = {
    eyebrow: "Repères rapides",
    title: "Comprendre cette fiche",
    intro: `Cette page conserve le pronostic ${row.label} pour ${row.home} – ${row.away} et son horodatage public.`,
    stats: [
      { label: "Pronostic", value: row.label },
      { label: "Probabilité estimée", value: fmtPct(row.modelProb) },
      { label: "Cote figée", value: oddsText },
      { label: "Publication", value: timingText },
    ],
    links: [
      {
        href: "/prediction-history",
        label: "Historique des pronostics",
        description: "Consulter les résultats conservés, y compris les pertes.",
      },
      {
        href: "/methodology",
        label: "Méthode BetGPT",
        description: "Voir comment les analyses et vérifications sont construites.",
      },
      {
        href: "/data-sources",
        label: "Sources de données",
        description: "Comprendre l’origine des données utilisées sur le site.",
      },
      {
        href: "/ledger",
        label: "Bilan public",
        description: "Revenir au registre global et à son suivi de performance.",
      },
    ],
  };

  return (
    <AstraSidewings
      left={leftWing}
      right={rightWing}
      ariaLabel={`Contexte et navigation pour ${row.home} – ${row.away}`}
    >
      <article className="space-y-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-sage">Registre public</p>
        <header className="rounded-xl border border-line bg-surface p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={status === "verified" ? "sage" : status === "partial" ? "clay" : "mist"}>
              {statusLabel}
            </Badge>
            <Badge tone={lifecycleLabel === "Publié" ? "mist" : "sage"}>{lifecycleLabel}</Badge>
            {row.result === "win" ? <Badge tone="sage">Gagnant</Badge> : null}
            {row.result === "lose" ? <Badge tone="rust">Perdant</Badge> : null}
            {row.result === "void" ? <Badge tone="mist">Annulé</Badge> : null}
          </div>
          <h1 className="mt-3 flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
            <Crest name={row.home} short={row.home.slice(0, 3)} size={28} />
            {row.home} – {row.away}
            <Crest name={row.away} short={row.away.slice(0, 3)} size={28} />
          </h1>
          <p className="mt-2 text-sm text-mist">
            BetGPT ne supprime pas les pronostics perdants. Pas une certitude. 18+.
          </p>
        </header>

        <section className="grid gap-3 sm:grid-cols-2">
          <Fact label="Pronostic" value={row.label} />
          <Fact label="Marché" value={row.market} />
          <Fact label="Probabilité estimée" value={fmtPct(row.modelProb)} />
          <Fact label="Avantage estimé" value={Number.isFinite(row.ev) ? fmtPct(row.ev) : "Non collecté"} />
          <Fact label="Cote figée" value={oddsText} />
          <Fact label="Cote enregistrée à" value={utc(row.recordedAt)} />
          <Fact label="Publié" value={utc(row.recordedAt)} />
          <Fact label="Coup d'envoi" value={utc(row.kickoff)} />
          <Fact
            label="Publié avant le coup d'envoi"
            value={beforeKickoff ? "OUI" : "NON"}
          />
          <Fact
            label="Écart"
            value={
              minutes == null
                ? "Indisponible"
                : minutes >= 0
                  ? `${minutes} min avant le coup d'envoi`
                  : `${Math.abs(minutes)} min après le coup d'envoi`
            }
          />
          <Fact
            label="Vérification de la preuve"
            value={integrity === "ok" ? "OK" : integrity === "mismatch" ? "Écart détecté" : "Indisponible"}
          />
          <Fact
            label="Score final"
            value={
              row.goalsHome != null && row.goalsAway != null
                ? `${row.goalsHome}–${row.goalsAway}`
                : "En attente"
            }
          />
          <Fact
            label="Règlement"
            value={row.result === "win" ? "Gagné" : row.result === "lose" ? "Perdu" : row.result === "void" ? "Annulé" : "En attente"}
          />
        </section>

        <details className="rounded-xl border border-line bg-surface p-5">
          <summary className="cursor-pointer text-sm font-semibold text-paper">
            Détails techniques de vérification
          </summary>
          <p className="mt-2 text-sm text-mist">
            Ces informations servent à vérifier qu’un pronostic n’a pas été réécrit après publication.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Fact
              label="Version interne"
              value={beforeKickoff ? (row.engineVersion ? "Enregistrée" : "Non collectée") : "Non collectée"}
            />
            <Fact
              label="Empreinte SHA-256"
              value={beforeKickoff && row.predictionHash ? row.predictionHash : "Non collectée"}
            />
          </div>
        </details>

        {row.snapshots && row.snapshots.length ? (
          <section className="rounded-xl border border-line bg-surface p-5">
            <h2 className="font-display text-lg">Révisions avant coup d'envoi</h2>
            <ol className="mt-3 space-y-2 text-sm text-mist">
              {row.snapshots.map((s, i) => (
                <li key={s.at}>
                  V{i + 1} · {utc(s.at)} · {s.label} @ {fmtOdds(s.odds)}
                </li>
              ))}
              <li>
                V{(row.revision ?? row.snapshots.length + 1)} · actuel · {row.label} @ {fmtOdds(row.odds)}
              </li>
            </ol>
          </section>
        ) : null}

        {events.length ? (
          <section className="rounded-xl border border-line bg-surface p-5">
            <h2 className="font-display text-lg">Journal</h2>
            <ul className="mt-3 space-y-1.5 text-sm text-mist">
              {events.map((e) => (
                <li key={e.id}>
                  {utc(e.at)} · {e.type.replaceAll("_", " ")}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <p className="text-sm">
          <Link to="/ledger" className="text-sage hover:underline">
            Retour au bilan
          </Link>
          {" · "}
          <Link
            to="/match/$matchId"
            params={{ matchId: row.matchId }}
            className="text-sage hover:underline"
          >
            Fiche match
          </Link>
        </p>
      </article>
    </AstraSidewings>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 break-all text-sm text-paper">{value}</p>
    </div>
  );
}
