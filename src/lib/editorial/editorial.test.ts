import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildEdition, applyEventOverride } from "./engine.ts";
import { newsEntries, learnTopics, renderNewsSitemap } from "./feed.ts";
import { qualityGate } from "./quality.ts";
import { optimizeTimes, parisDate, slotInstant } from "./time.ts";
import type { ArticleType, EditorialMatch, EditorialNewsSignal, SlotId } from "./types.ts";
import { autoPublishableCluster, clusterSignals, parseGoogleNewsRss, sourceTier } from "./news-scout.server.ts";

function match(over: Partial<EditorialMatch> & Pick<EditorialMatch, "id" | "home" | "away" | "kickoff">): EditorialMatch {
  return {
    league: "NL",
    competition: "Matchs de qualification de la Coupe Africaine des Nations",
    status: "scheduled",
    opening: { home: 2.1, draw: 3.2, away: 3.4, book: "Unibet" },
    current: [{ book: "Unibet", home: 2.1, draw: 3.2, away: 3.4 }],
    oddsSource: "Unibet",
    importance: { value: 0.7, confidence: 0.7, source: "calendrier" },
    venue: "Stade",
    ...over,
  };
}

const NOW = new Date("2026-09-25T17:30:00.000Z");
const EARLY = new Date("2026-09-24T22:16:00.000Z");

function board(): EditorialMatch[] {
  return [
    match({
      id: "sen",
      home: { name: "Mozambique" },
      away: { name: "Sénégal" },
      kickoff: "2026-09-25T13:00:00.000Z",
      opening: { home: 7, draw: 4.9, away: 1.3, book: "Unibet" },
      current: [{ book: "Unibet", home: 7, draw: 4.9, away: 1.3 }],
    }),
    match({
      id: "nga",
      home: { name: "Nigéria" },
      away: { name: "Madagascar" },
      kickoff: "2026-09-25T16:00:00.000Z",
    }),
    match({
      id: "rwa",
      home: { name: "Rwanda" },
      away: { name: "Liberia" },
      kickoff: "2026-09-25T18:00:00.000Z",
    }),
    match({
      id: "and",
      home: { name: "Andorre" },
      away: { name: "Pays de Galles" },
      kickoff: "2026-09-24T20:00:00.000Z",
      status: "finished",
      scoreHome: 1,
      scoreAway: 2,
    }),
  ];
}

describe("editorial engine", () => {
  it("keeps Paris slots closed before 08:00 and publishes them after 19:00", () => {
    assert.equal(parisDate(EARLY), "2026-09-25");
    assert.equal(parisDate(NOW), "2026-09-25");
    const early = buildEdition({ now: EARLY, matches: board() });
    assert.equal(early.articles.filter((article) => article.status === "PUBLISHED" || article.status === "UPDATED").length, 0);
    assert.ok(early.slots.every((slot) => slot.article?.status === "SCHEDULED" || slot.skipped));
    const open = buildEdition({ now: NOW, matches: board() });
    const published = open.articles.filter((article) => article.status === "PUBLISHED");
    assert.equal(published.length, 3);
    assert.equal(open.targetPerDay, 3);
    assert.equal(open.publicationPolicy, "OPPORTUNITY_DRIVEN_MAX_3");
    assert.equal(new Set(published.map((article) => article.id)).size, published.length);
    for (const article of published) {
      assert.equal(article.quality.pass, true);
      assert.ok(article.image.width >= 1200);
      assert.ok(article.h1.length > 20);
      assert.ok(Date.parse(article.publishedAt ?? "") >= slotInstant(open.parisDate, article.scheduledTime).getTime());
      assert.ok(!/incroyable|mise conseillée|composition officielle est/i.test(article.h1 + article.lead));
      assert.ok(article.sources.every((source) => source.status !== "OFFICIAL"));
    }
  });

  it("is idempotent for the same desk", () => {
    const a = buildEdition({ now: NOW, matches: board() });
    const b = buildEdition({ now: NOW, matches: board(), frozen: a.articles });
    assert.deepEqual(
      a.articles.map((article) => [article.id, article.slug, article.publishedAt, article.factHash]),
      b.articles.map((article) => [article.id, article.slug, article.publishedAt, article.factHash]),
    );
  });

  it("updates the same URL when the score changes and does not mint a second job", () => {
    const first = buildEdition({ now: NOW, matches: board() });
    const changed = board().map((item) => (item.id === "and" ? { ...item, scoreHome: 0, scoreAway: 3 } : item));
    const second = buildEdition({ now: new Date("2026-09-25T17:00:00.000Z"), matches: changed, frozen: first.articles });
    const before = first.articles.find((article) => article.matchId === "and");
    const after = second.articles.find((article) => article.matchId === "and");
    if (before && after) {
      assert.equal(after.slug, before.slug);
      assert.equal(after.publishedAt, before.publishedAt);
      assert.equal(after.status, "UPDATED");
      assert.equal(after.corrections.length, 1);
      const third = buildEdition({ now: new Date("2026-09-25T17:05:00.000Z"), matches: changed, frozen: second.articles });
      const stable = third.articles.find((article) => article.matchId === "and");
      assert.equal(stable?.corrections.length, 1);
    }
  });

  it("fail-closes when nothing is knowable", () => {
    const edition = buildEdition({ now: NOW, matches: [] });
    assert.equal(edition.articles.length, 0);
    assert.ok(edition.skipped.length >= 1);
    assert.match(edition.skipped[0]!.reason, /FAIL_CLOSED/);
  });

  it("does not move a slot without enough measurements", () => {
    const same = optimizeTimes({ morning: "08:00", noon: "13:00", evening: "19:00" }, { morning: { samples: 3, ctr: 0.2, organicSessions: 1, discoverClicks: null, suggestedShiftMin: -25 } });
    assert.equal(same.times.morning, "08:00");
    const moved = optimizeTimes(
      { morning: "08:00", noon: "13:00", evening: "19:00" },
      { morning: { samples: 30, ctr: 0.08, organicSessions: 40, discoverClicks: 2, suggestedShiftMin: -25 } },
    );
    assert.equal(moved.times.morning, "07:40");
    assert.equal(moved.changes[0]?.oldTime, "08:00");
    assert.equal(moved.changes[0]?.newTime, "07:40");
  });

  it("replaces a weak slot instead of adding a fourth article", () => {
    const selected: { slot: SlotId; score: number; articleType: ArticleType; matchId: string | null }[] = [
      { slot: "morning", score: 70, articleType: "slate", matchId: null },
      { slot: "noon", score: 60, articleType: "preview", matchId: "a" },
      { slot: "evening", score: 50, articleType: "preview", matchId: "b" },
    ];
    const next = applyEventOverride(selected, [
      { slot: "evening", score: 90, articleType: "postmatch", matchId: "c" },
    ]);
    assert.equal(next.length, 3);
    assert.ok(next.some((row) => row.matchId === "c"));
    assert.ok(!next.some((row) => row.matchId === "b"));
  });

  it("keeps the news sitemap inside two days and rejects clickbait", () => {
    const edition = buildEdition({ now: NOW, matches: board() });
    const entries = newsEntries(edition, NOW.getTime());
    for (const entry of entries) assert.ok(NOW.getTime() - Date.parse(entry.published) <= 2 * 86400000);
    const xml = renderNewsSitemap(
      newsEntries(edition, NOW.getTime()).filter((entry) => Date.parse(entry.published) >= NOW.getTime() - 2 * 86400000),
    );
    const stale = renderNewsSitemap([
      {
        loc: "https://betgpt.live/actualites/vieux",
        title: "Vieil article",
        published: "2026-09-20T08:00:00.000Z",
        keywords: "football",
      },
    ]);
    assert.match(xml, /<news:name>BetGPT<\/news:name>/);
    assert.match(xml, /<news:language>fr<\/news:language>/);
    assert.match(stale, /vieux/);
    const cutoff = NOW.getTime() - 2 * 86400000;
    assert.ok(Date.parse("2026-09-20T08:00:00.000Z") < cutoff);
    const bad = qualityGate(
      {
        articleType: "news",
        title: "INCROYABLE",
        h1: "INCROYABLE !!!",
        lead: "x".repeat(90),
        paragraphs: [
          { h2: "a", body: "b".repeat(180) },
          { h2: "c", body: "d".repeat(180) },
          { h2: "e", body: "f".repeat(180) },
        ],
        sources: [{ id: "s", label: "desk", status: "HIGH_CONFIDENCE", note: "fait" }],
        image: { src: "/blog/discover/inline-night.jpg", alt: "stade", width: 1200, height: 675, credit: "libre" },
        links: [{ href: "/scores-en-direct", label: "Scores" }],
        teams: ["Sénégal"],
        competition: "CAN",
      },
      [],
    );
    assert.equal(bad.pass, false);
  });


  it("never auto-publishes a generic daily programme as a Discover article", () => {
    const edition = buildEdition({ now: NOW, matches: board() });
    assert.ok(edition.articles.every((article) => article.articleType !== "slate"));
    assert.ok(edition.articles.every((article) => !/^Programme du /i.test(article.h1)));
  });

  it("keeps public copy in French reader language and hides pipeline jargon", () => {
    const edition = buildEdition({ now: NOW, matches: board() });
    const publicText = edition.articles
      .map((article) => [article.h1, article.lead, ...article.paragraphs.map((part) => part.body)].join(" "))
      .join(" ");
    assert.doesNotMatch(publicText, /desk BetGPT|score interne|créneau ouvert|déjà ingéré|pas un pronostic inventé/i);
    assert.doesNotMatch(publicText, /\b(horario|alineaciones?|resultado|dónde ver|clasificación)\b/i);
  });

  it("requires a Discover Opportunity score of at least 70 for every generated article", () => {
    const edition = buildEdition({ now: NOW, matches: board() });
    for (const article of edition.articles) {
      assert.ok(article.discoverOpportunity.total >= 70);
      assert.notEqual(article.discoverOpportunity.decision, "REJECT");
    }
  });



  it("publishes a corroborated fresh news cluster at most once", () => {
    const signals: EditorialNewsSignal[] = [
      {
        id: "n1",
        title: "PSG : un titulaire forfait avant le prochain match - L'Équipe",
        url: "https://news.google.com/articles/n1",
        sourceName: "L'Équipe",
        sourceUrl: "https://www.lequipe.fr",
        publishedAt: "2026-09-25T15:55:00.000Z",
        description: "Le PSG doit composer avec un forfait avant son prochain match.",
        sourceTier: "TIER1",
        entities: ["PSG"],
        language: "fr",
      },
      {
        id: "n2",
        title: "PSG : forfait confirmé dans le groupe avant la rencontre - RMC Sport",
        url: "https://news.google.com/articles/n2",
        sourceName: "RMC Sport",
        sourceUrl: "https://rmcsport.bfmtv.com",
        publishedAt: "2026-09-25T16:02:00.000Z",
        description: "RMC Sport rapporte également l'absence avant la rencontre.",
        sourceTier: "TIER1",
        entities: ["PSG"],
        language: "fr",
      },
    ];
    const edition = buildEdition({ now: NOW, matches: [], signals });
    const news = edition.articles.filter((article) => article.articleType === "news");
    assert.equal(news.length, 1);
    assert.ok(news[0]!.sources.filter((source) => source.status === "CORROBORATED").length >= 2);
    assert.ok(news[0]!.discoverOpportunity.total >= 70);
  });

  it("keeps a material resolution separate from the earlier controversy", () => {
    const signals: EditorialNewsSignal[] = [
      {
        id: "story-1",
        title: "Real Madrid : polémique autour du déplacement de Kylian Mbappé",
        url: "https://news.google.com/articles/story-1",
        sourceName: "L'Équipe",
        sourceUrl: "https://www.lequipe.fr",
        publishedAt: "2026-09-25T08:45:00.000Z",
        description: "Le déplacement de Kylian Mbappé fait débat à Madrid.",
        sourceTier: "TIER1",
        entities: ["Real Madrid", "Kylian Mbappé"],
        language: "fr",
      },
      {
        id: "story-2",
        title: "Kylian Mbappé : son déplacement à Paris fait débat au Real Madrid",
        url: "https://news.google.com/articles/story-2",
        sourceName: "RMC Sport",
        sourceUrl: "https://rmcsport.bfmtv.com",
        publishedAt: "2026-09-25T09:00:00.000Z",
        description: "Le même déplacement provoque des questions autour du Real Madrid.",
        sourceTier: "TIER1",
        entities: ["Real Madrid", "Kylian Mbappé"],
        language: "fr",
      },
      {
        id: "resolution-1",
        title: "Le Real Madrid a autorisé Kylian Mbappé à se rendre à Paris",
        url: "https://news.google.com/articles/resolution-1",
        sourceName: "Foot Mercato",
        sourceUrl: "https://www.footmercato.net",
        publishedAt: "2026-09-25T13:49:00.000Z",
        description: "Le club avait donné son autorisation au joueur pour ce déplacement.",
        sourceTier: "TIER1",
        entities: ["Real Madrid", "Kylian Mbappé"],
        language: "fr",
      },
      {
        id: "resolution-2",
        title: "Mbappé : le Real Madrid avait donné son autorisation pour Paris",
        url: "https://news.google.com/articles/resolution-2",
        sourceName: "L'Équipe",
        sourceUrl: "https://www.lequipe.fr",
        publishedAt: "2026-09-25T13:55:00.000Z",
        description: "Une seconde source rapporte que le déplacement avait été autorisé.",
        sourceTier: "TIER1",
        entities: ["Real Madrid", "Kylian Mbappé"],
        language: "fr",
      },
    ];
    const clusters = clusterSignals(signals);
    assert.equal(clusters.length, 2);
    const resolution = clusters.find((cluster) => cluster.signals.some((signal) => signal.id === "resolution-1"));
    assert.ok(resolution);
    assert.equal(resolution.signals.length, 2);
    assert.equal(autoPublishableCluster(resolution), true);
  });

  it("does not auto-publish a single non-official media signal", () => {
    const signals: EditorialNewsSignal[] = [
      {
        id: "single",
        title: "PSG : un changement annoncé avant le match - L'Équipe",
        url: "https://news.google.com/articles/single",
        sourceName: "L'Équipe",
        sourceUrl: "https://www.lequipe.fr",
        publishedAt: "2026-09-25T16:00:00.000Z",
        description: "Une seule source journalistique traite le sujet.",
        sourceTier: "TIER1",
        entities: ["PSG"],
        language: "fr",
      },
    ];
    const edition = buildEdition({ now: NOW, matches: [], signals });
    assert.equal(edition.articles.filter((article) => article.articleType === "news").length, 0);
  });

  it("accepts a newsworthy official signal without requiring a second outlet", () => {
    const signals: EditorialNewsSignal[] = [
      {
        id: "official",
        title: "Équipe de France : la FFF annonce un changement dans le groupe",
        url: "https://news.google.com/articles/official",
        sourceName: "FFF",
        sourceUrl: "https://www.fff.fr",
        publishedAt: "2026-09-25T16:05:00.000Z",
        description: "La Fédération française de football annonce un changement dans le groupe.",
        sourceTier: "OFFICIAL",
        entities: ["France"],
        language: "fr",
      },
    ];
    const clusters = clusterSignals(signals);
    assert.equal(clusters.length, 1);
    assert.equal(autoPublishableCluster(clusters[0]!), true);
    const edition = buildEdition({ now: NOW, matches: [], signals });
    const news = edition.articles.find((article) => article.articleType === "news");
    assert.ok(news);
    assert.ok(news.sources.some((source) => source.status === "OFFICIAL"));
  });

  it("parses Google News RSS and classifies source tiers", () => {
    const xml = `<?xml version="1.0"?><rss><channel><item><title><![CDATA[PSG : blessure avant le match - L'Équipe]]></title><link>https://news.google.com/articles/test</link><pubDate>Fri, 25 Sep 2026 16:00:00 GMT</pubDate><description><![CDATA[Une information récente concernant le PSG.]]></description><source url="https://www.lequipe.fr">L'Équipe</source></item></channel></rss>`;
    const rows = parseGoogleNewsRss(xml, NOW);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.sourceTier, "TIER1");
    assert.ok(rows[0]!.entities.includes("PSG"));
    assert.equal(sourceTier("https://www.fff.fr", "FFF"), "OFFICIAL");
  });

  it("does not invent topic learning", () => {
    assert.equal(learnTopics([{ league: "L1", type: "preview", clicks: null }]).status, "UNKNOWN");
  });

  it("never recommends a price under 1.80 as a selection", () => {
    const edition = buildEdition({ now: NOW, matches: board() });
    const senegal = edition.articles.find((article) => article.matchId === "sen");
    assert.ok(senegal, "le match à cote 1,30 doit avoir sa page, pas seulement la liste");
    assert.match(senegal.paragraphs.map((part) => part.body).join(" "), /sous 1,80/);
  });

  it("rejects internally repetitive and templated editorial copy", () => {
    const repeated = "Cette phrase de contrôle éditorial est volontairement répétée pour simuler un article industriel sans valeur ajoutée.";
    const result = qualityGate(
      {
        articleType: "news",
        title: "PSG : analyse avant le prochain match",
        h1: "PSG : les points à contrôler avant le prochain match",
        lead: "Cette analyse rassemble des éléments vérifiables avant la rencontre et sépare les faits connus des hypothèses encore incertaines.",
        paragraphs: [
          { h2: "Contexte", body: repeated + " " + repeated },
          { h2: "Données", body: repeated + " Un autre élément suffisamment long complète ce paragraphe pour tester le filtre de qualité." },
          { h2: "Marché", body: "Cette troisième partie contient un texte distinct et suffisamment long pour que le test cible bien la répétition et non une section trop mince." },
        ],
        sources: [{ id: "src", label: "L'Équipe", status: "HIGH_CONFIDENCE", note: "information sportive vérifiée" }],
        image: { src: "/blog/discover/test.jpg", alt: "stade de football", width: 1200, height: 675, credit: "libre" },
        links: [{ href: "/scores-en-direct", label: "Scores en direct" }],
        teams: ["PSG"],
        competition: "Ligue 1",
      },
      [],
    );
    assert.equal(result.pass, false);
    assert.ok(result.reasons.includes("répétitions internes excessives"));
  });

  it("rejects stock SEO filler even when it appears only once", () => {
    const result = qualityGate(
      {
        articleType: "news",
        title: "PSG : données et contexte avant la rencontre",
        h1: "PSG : données et contexte avant la prochaine rencontre",
        lead: "Cette analyse distingue les données connues des hypothèses et conserve une formulation destinée à être vérifiée avant le coup d’envoi.",
        paragraphs: [
          { h2: "Premier point", body: "Cette vérification est particulièrement importante pour la requête PSG pronostic, car le lecteur doit pouvoir distinguer le fait du commentaire éditorial." },
          { h2: "Deuxième point", body: "Le second paragraphe apporte un angle réellement différent sur le calendrier, la récupération et les informations disponibles avant le match." },
          { h2: "Troisième point", body: "Le troisième paragraphe relie les données au scénario du match sans transformer une estimation en certitude ni masquer les éléments manquants." },
        ],
        sources: [{ id: "src", label: "RMC Sport", status: "HIGH_CONFIDENCE", note: "information sportive vérifiée" }],
        image: { src: "/blog/discover/test-2.jpg", alt: "terrain de football", width: 1200, height: 675, credit: "libre" },
        links: [{ href: "/scores-en-direct", label: "Scores en direct" }],
        teams: ["PSG"],
        competition: "Ligue 1",
      },
      [],
    );
    assert.equal(result.pass, false);
    assert.ok(result.reasons.includes("remplissage éditorial générique détecté"));
  });

});
