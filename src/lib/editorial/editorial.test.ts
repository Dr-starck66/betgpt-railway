describe("native Qwen H2 uniqueness", () => {
  it("constrains each of the seven model responses to a different predetermined H2 without relaxing length or source guards", () => {
    const first = sectionResponseSchema(["source-1", "source-2"], true, "Les faits confirmés et leur importance immédiate") as { oneOf: Array<{ properties: Record<string, any> }> };
    const second = sectionResponseSchema(["source-1", "source-2"], false, "La chronologie établie par les sources") as { oneOf: Array<{ properties: Record<string, any> }> };
    assert.equal(first.oneOf[1]!.properties.h2.const, "Les faits confirmés et leur importance immédiate");
    assert.equal(second.oneOf[1]!.properties.h2.const, "La chronologie établie par les sources");
    assert.notEqual(first.oneOf[1]!.properties.h2.const, second.oneOf[1]!.properties.h2.const);
    assert.equal(first.oneOf[1]!.properties.body.minLength, 800);
    assert.equal(second.oneOf[1]!.properties.subsections.minItems, 1);
    assert.deepEqual(second.oneOf[1]!.properties.sourceIds.items.enum, ["source-1", "source-2"]);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildEdition, applyEventOverride, composeNews } from "./engine.ts";
import { newsEntries, learnTopics, renderNewsSitemap } from "./feed.ts";
import { qualityGate } from "./quality.ts";
import { manualEditorialArticles } from "./manual-articles.ts";
import { editorialGoldStandardGate } from "./gold-standard.ts";
import { optimizeTimes, parisDate, slotInstant } from "./time.ts";
import type { ArticleType, EditorialMatch, EditorialNewsSignal, SlotId } from "./types.ts";
import { autoPublishableCluster, clusterSignals, fairPublisherSignals, parseGoogleNewsRss, parsePublisherRss, sourceTier } from "./news-scout.server.ts";
import { hasAutomaticProof, publishedTodayForQuota, eligiblePublishingSlots, sectionResponseSchema, boundedEvidenceSlices, extractPublicArticle, publicPublisherRssEvidence, publisherUrl } from "./auto-reporter.server.ts";
import { clusterSignals as clusterAutoReporterSignals, isMaterialDevelopment as isAutoReporterMaterial } from "./news-cluster.ts";

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


describe("first-party full-text RSS evidence", () => {
  it("accepts publisher-owned content:encoded only for verified canonical publisher URLs", () => {
    const now = new Date("2026-10-24T18:00:00.000Z");
    const body = "<p>" + "Compte rendu officiel public avec des faits détaillés et des citations vérifiables. ".repeat(13) + "</p>";
    const rss = '<rss><channel><item><title>Événement vérifié</title><link>https://www.sofoot.com/football/evenement-verifie</link>' +
      '<pubDate>Sat, 24 Oct 2026 17:00:00 GMT</pubDate><description>Résumé court</description>' +
      '<content:encoded><![CDATA[' + body + ']]></content:encoded></item></channel></rss>';
    const signals = parsePublisherRss(rss, now, { sourceName: "So Foot", origin: "https://www.sofoot.com", tier: "TIER1" });
    assert.equal(signals.length, 1);
    assert.ok((signals[0]?.publisherRssBody?.length ?? 0) >= 750);
    assert.ok(publicPublisherRssEvidence(signals[0]!)?.text.length);
  });
  it("rejects a short snippet, aggregator pointer and missing full feed body", () => {
    const now = new Date("2026-10-24T18:00:00.000Z");
    const rss = '<rss><channel><item><title>Actualité</title><link>https://news.google.com/rss/articles/abc123</link>' +
      '<pubDate>Sat, 24 Oct 2026 17:00:00 GMT</pubDate><content:encoded><![CDATA[' +
      "Faits divers. ".repeat(110) + ']]></content:encoded></item></channel></rss>';
    assert.equal(parsePublisherRss(rss, now, { sourceName: "So Foot", origin: "https://www.sofoot.com", tier: "TIER1" }).length, 0);
    const valid = parsePublisherRss(rss.replace("https://news.google.com/rss/articles/abc123",
      "https://www.sofoot.com/football/article-reel"), now,
      { sourceName: "So Foot", origin: "https://www.sofoot.com", tier: "TIER1" })[0]!;
    assert.ok(publicPublisherRssEvidence(valid));
    assert.equal(publicPublisherRssEvidence({ ...valid, publisherRssBody: "Résumé trop court" }), null);
  });
});

describe("first-party article evidence extraction", () => {
  it("recovers public NewsArticle JSON-LD from a publisher's client-rendered article", () => {
    const body = "Le communiqué précise la décision, sa chronologie et les conséquences sportives documentées. ".repeat(17).trim();
    const html = '<script type="application/ld+json">' +
      JSON.stringify({ "@graph": [{ "@type": "NewsArticle", articleBody: body }] }) +
      '</script><article><div id="client-render"></div></article>';
    assert.equal(extractPublicArticle(html), body);
  });
  it("refuses navigation padding and unrelated JSON-LD", () => {
    const filler = "Le menu de navigation ne prouve aucun événement journalistique et doit être rejeté. ".repeat(20);
    const html = '<nav><p>' + filler + '</p></nav><script type="application/ld+json">' +
      JSON.stringify({ "@type": "WebSite", articleBody: filler }) + '</script><article><p>Une dépêche courte.</p></article>';
    assert.equal(extractPublicArticle(html), "");
  });
  it("accepts long first-party article paragraphs without JSON-LD", () => {
    const p = "Le club précise son calendrier et communique une information officielle détaillée concernant la rencontre. ";
    const html = '<article>' + Array.from({ length: 10 }, (_v, n) => '<p>' + n + ' ' + p + '</p>').join("") + '</article>';
    assert.ok(extractPublicArticle(html).length >= 750);
  });
});


describe("publisher article body recovery (strict 750-character gate)", () => {
  it("retains first-party short paragraphs without lowering the evidence threshold", () => {
    const p = "Le club confirme un nouveau fait précis sur ce match.";
    const html = "<article>" + Array.from({ length: 20 }, (_, i) => "<p>" + i + " " + p + "</p>").join("") + "</article>";
    assert.ok(extractPublicArticle(html).length >= 750);
    assert.equal(extractPublicArticle("<article><p>" + p + "</p></article>"), "");
  });
  it("accepts explicit publisher article-body containers, not arbitrary page filler", () => {
    const line = "Le rapport officiel précise le score et la chronologie vérifiée de la rencontre.";
    const body = Array.from({ length: 13 }, (_, i) => "<p>" + i + " " + line + "</p>").join("");
    assert.ok(extractPublicArticle('<nav>' + body + '</nav><div data-testid="article-body">' + body + '</div>').length >= 750);
    assert.equal(extractPublicArticle('<nav>' + body + '</nav><div class="navigation-menu">' + body + '</div>'), "");
  });
});


describe("event-level source corroboration stays fail-closed", () => {
  it("separates unrelated same-team results despite generic shared result language", () => {
    const row = (id: string, title: string, entities: string[]): EditorialNewsSignal => ({
      id, title, url: "https://" + id + ".example.com/football/story",
      sourceName: id, sourceUrl: "https://" + id + ".example.com",
      publishedAt: "2026-10-28T08:00:00.000Z", sourceTier: "TIER1",
      entities, language: "en",
    });
    const rows = [
      row("bbc", "Arsenal knocked out by Fleetwood in League Cup", ["Arsenal", "Fleetwood"]),
      row("sky", "Fleetwood eliminate Arsenal on penalties", ["Arsenal", "Fleetwood"]),
      row("unrelated", "Arsenal lose historic match to Chelsea in Premier League", ["Arsenal", "Chelsea"]),
    ];
    const clusters = clusterAutoReporterSignals(rows);
    const fleetwood = clusters.find((c) => c.signals.some((s) => s.id === "bbc"))!;
    assert.deepEqual(fleetwood.signals.map((s) => s.id).sort(), ["bbc", "sky"]);
    assert.equal(clusters.reduce((n, c) => n + c.signals.length, 0), 3);
    assert.equal(clusters.length, 2);
  });
});


describe("publisher evidence diversity under a bounded quota", () => {
  it("does not starve late independent editorial outlets behind high-volume feeds", () => {
    const make = (publisher: string, index: number): EditorialNewsSignal => ({
      id: publisher + "-" + index,
      title: "Actualité football vérifiée " + publisher + " événement distinct numero " + String(index).padStart(4, "0"),
      url: "https://" + publisher.toLowerCase() + ".example/football/article-" + index,
      sourceName: publisher,
      sourceUrl: "https://" + publisher.toLowerCase() + ".example",
      publishedAt: "2026-10-24T11:00:00.000Z",
      description: "Une actualité dont les faits resteront à corroborer avant publication.",
      sourceTier: "TIER1",
      entities: ["Football"],
      language: "fr",
    });
    const early = Array.from({ length: 6 }, (_unused, i) =>
      Array.from({ length: 16 }, (_unused, n) => make("Early" + i, n)));
    const late = [make("SoFoot", 1), make("Football365", 1)];
    const selected = fairPublisherSignals([...early, [late[0]!], [late[1]!]], 90);
    assert.equal(selected.length, 90);
    assert.ok(selected.some((signal) => signal.sourceName === "SoFoot"));
    assert.ok(selected.some((signal) => signal.sourceName === "Football365"));
    assert.equal(new Set(selected.map((signal) => signal.url)).size, 90);
    assert.ok(selected.filter((signal) => signal.sourceName === "Early0").length <= 16);
  });
});

describe("publisher source provenance", () => {
  it("only accepts fresh HTTPS deep links on the publisher's real domain", () => {
    const now = new Date("2026-10-24T08:00:00.000Z");
    const pub = '<pubDate>Sat, 24 Oct 2026 07:20:00 GMT</pubDate>';
    const mk = (link: string, title: string) => '<item><title><![CDATA[' + title +
      ']]></title><link>' + link + '</link>' + pub +
      '<description><![CDATA[PSG et Lyon : la ligue publie une décision sur le calendrier.]]></description></item>';
    const rss = '<rss><channel>' +
      mk('https://www.lfp.fr/article/decision-officielle-psg-lyon', 'PSG et Lyon : décision officielle') +
      mk('https://news.google.com/rss/articles/something', 'PSG et Lyon : page agrégateur') +
      mk('https://lfp.fr.evil.example/article/psg-lyon', 'PSG et Lyon : imitation') +
      mk('https://www.lfp.fr/', 'PSG et Lyon : page accueil') +
      mk('http://www.lfp.fr/article/redirect', 'PSG et Lyon : HTTP refusé') +
      '</channel></rss>';
    const rows = parsePublisherRss(rss, now, {
      sourceName: "LFP", origin: "https://www.lfp.fr", tier: "OFFICIAL",
    });
    assert.equal(rows.length, 1, "Only a real publisher HTTPS article is citable");
    assert.equal(rows[0]?.url, 'https://www.lfp.fr/article/decision-officielle-psg-lyon');
    assert.equal(rows[0]?.sourceTier, "OFFICIAL");
    assert.equal(rows[0]?.sourceName, "LFP");
    const bbc = parsePublisherRss('<rss><channel><item><title>Arsenal and Chelsea news</title><link>https://www.bbc.co.uk/sport/football/articles/example</link><pubDate>Sat, 24 Oct 2026 07:20:00 GMT</pubDate></item></channel></rss>', now, { sourceName: "BBC Sport", origin: "https://www.bbc.com", tier: "TIER1" });
    assert.equal(bbc.length, 1, "BBC UK and COM are both verified BBC editorial domains");
  });
});

describe("news auto-authoring guard", () => {
  it("creates seven distinct cited sections but refuses to treat thin RSS as Gold Standard content", () => {
    const date = "2026-10-24T07:30:00.000Z";
    const signal = (id: string, name: string, url: string, tier: EditorialNewsSignal["sourceTier"]): EditorialNewsSignal => ({
      id,
      title: "PSG et Lyon : décision confirmée sur la programmation du championnat",
      url,
      sourceName: name,
      sourceUrl: new URL(url).origin,
      publishedAt: date,
      description: "Une décision annoncée ce matin modifie la programmation de la rencontre et doit être vérifiée auprès des organisateurs.",
      sourceTier: tier,
      entities: ["PSG", "Lyon"],
      language: "fr",
    });
    const signals = [
      signal("fff", "FFF", "https://www.fff.fr/article/decision", "OFFICIAL"),
      signal("sports", "L'Équipe", "https://www.lequipe.fr/Football/decision", "TIER1"),
      signal("press", "Reuters", "https://www.reuters.com/world/decision", "TIER1"),
    ];
    const cluster = {
      id: "validated-editorial-cluster",
      signals,
      title: "PSG et Lyon : décision confirmée sur la programmation du championnat",
      entities: ["PSG", "Lyon"],
      official: true,
      distinctSources: 3,
      publishedAt: date,
      newsworthy: true,
    };
    const draft = composeNews(cluster, [], "noon", "2026-10-24", date, true);
    assert.equal(draft.paragraphs.length, 7, "Seven materially different H2 are required");
    assert.equal(new Set(draft.paragraphs.map((p) => p.h2)).size, 7);
    assert.ok(draft.paragraphs.every((p) => p.sourceIds?.length), "Every H2 must cite actual evidence");
    const body = [draft.h1, draft.lead, ...draft.paragraphs.map((p) => p.h2 + " " + p.body)].join(" ");
    assert.doesNotMatch(body, /le cluster contient|les entités explicitement détectées|la chronologie des publications|pourquoi BetGPT ne force pas un contexte de match|aucune déclaration officielle n.est ajoutée artificiellement|alimentent ce cluster/i);
    const gold = editorialGoldStandardGate({
      ...draft,
      image: {src: "/blog/discover/inline-crowd.jpg", alt: "Tribunes du stade", width: 1200, height: 675, credit: "Illustration créditée"},
    });
    assert.equal(gold.pass, false, "Three brief RSS summaries cannot justify a 1500-word story");
    assert.ok(gold.reasons.some((r) => /minimum 1500/.test(r)), JSON.stringify(gold.reasons));
    assert.ok(!gold.reasons.some((r) => /minimum 7/.test(r)), JSON.stringify(gold.reasons));
  });
});

describe("editorial engine", () => {
  it("keeps Paris slots closed and refuses shallow match templates instead of force-publishing", () => {
    assert.equal(parisDate(EARLY), "2026-09-25");
    assert.equal(parisDate(NOW), "2026-09-25");
    const early = buildEdition({ now: EARLY, matches: board() });
    assert.equal(early.articles.filter((article) => article.status === "PUBLISHED" || article.status === "UPDATED").length, 0);
    assert.ok(early.slots.every((slot) => slot.article?.status === "SCHEDULED" || slot.skipped));
    const open = buildEdition({ now: NOW, matches: board() });
    const published = open.articles.filter((article) => article.status === "PUBLISHED");
    assert.equal(published.length, 0, "3 short generic articles must never be published to satisfy a quota");
    assert.ok(open.skipped.length >= 1);
    assert.ok(open.skipped.some((row) => /référence éditoriale/.test(row.reason)));
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
    const strong = manualEditorialArticles().find((article) => article.slug.includes("manchester-city-18-points"))!;
    assert.equal(editorialGoldStandardGate(strong).pass, true);
    const sourced = { ...strong, id: "published-sourced-test", createdAt: NOW.toISOString(), publishedAt: NOW.toISOString(), modifiedAt: NOW.toISOString(), parisDate: parisDate(NOW) };
    const editionWithNews = { ...edition, articles: [sourced] };
    const entries = newsEntries(editionWithNews, NOW.getTime());
    for (const entry of entries) assert.ok(NOW.getTime() - Date.parse(entry.published) <= 2 * 86400000);
    const xml = renderNewsSitemap(
      newsEntries(editionWithNews, NOW.getTime()).filter((entry) => Date.parse(entry.published) >= NOW.getTime() - 2 * 86400000),
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



  it("keeps short corroborated news in candidates but refuses to publish it below the newsroom reference", () => {
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
    assert.equal(news.length, 0, "two headlines are not a researched 1500-word article");
    assert.ok(edition.candidates.some((candidate) => candidate.articleType === "news"));
    assert.ok(edition.skipped.some((skip) => /référence éditoriale/.test(skip.reason)));
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

  it("keeps unrelated Cristiano Ronaldo stories in separate clusters", () => {
    const signals: EditorialNewsSignal[] = [
      {
        id: "ronaldo-rupture",
        title: "Les dessous de la rupture entre Cristiano Ronaldo et le Portugal | Foot - Portugal - L'Équipe",
        url: "https://news.google.com/articles/ronaldo-rupture",
        sourceName: "L'Équipe",
        sourceUrl: "https://www.lequipe.fr",
        publishedAt: "2026-10-01T14:27:00.000Z",
        description: "Un récit consacré aux tensions et à la rupture entre Cristiano Ronaldo et la sélection portugaise.",
        sourceTier: "TIER1",
        entities: ["Cristiano Ronaldo", "Portugal"],
        language: "fr",
      },
      {
        id: "ronaldo-retirement",
        title: "Portugal : Cristiano Ronaldo va prendre sa retraite internationale ! - Foot Mercato",
        url: "https://news.google.com/articles/ronaldo-retirement",
        sourceName: "Foot Mercato",
        sourceUrl: "https://www.footmercato.net",
        publishedAt: "2026-10-01T14:15:00.000Z",
        description: "Une information distincte porte sur la retraite internationale du joueur.",
        sourceTier: "TIER1",
        entities: ["Cristiano Ronaldo", "Portugal"],
        language: "fr",
      },
      {
        id: "ronaldo-profile",
        title: "Foot : cinq grands moments de Cristiano Ronaldo avec le Portugal - lenouvelliste.com",
        url: "https://news.google.com/articles/ronaldo-profile",
        sourceName: "lenouvelliste.com",
        sourceUrl: "https://www.lenouvelliste.com",
        publishedAt: "2026-10-01T14:16:00.000Z",
        description: "Une rétrospective revient sur cinq grands moments de sa carrière avec le Portugal.",
        sourceTier: "OTHER",
        entities: ["Cristiano Ronaldo", "Portugal"],
        language: "fr",
      },
    ];
    const clusters = clusterSignals(signals);
    assert.equal(clusters.length, 3);
    assert.ok(clusters.every((cluster) => cluster.signals.length === 1));
    assert.ok(clusters.every((cluster) => !autoPublishableCluster(cluster)));
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

  it("keeps a thin official signal eligible but refuses to publish a thin article", () => {
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
    assert.equal(news, undefined);
  });

  it("does not auto-publish even a rich primary-source item without corroboration", () => {
    const signals: EditorialNewsSignal[] = [
      {
        id: "official-rich",
        title: "Équipe de France : la FFF annonce un changement dans le groupe",
        url: "https://news.google.com/articles/official-rich",
        sourceName: "FFF",
        sourceUrl: "https://www.fff.fr",
        publishedAt: "2026-09-25T16:05:00.000Z",
        description:
          "La Fédération française de football annonce officiellement une modification de la liste de l'équipe de France après un point médical réalisé dans l'après-midi. Le communiqué précise l'identité du joueur concerné, la raison sportive de la décision, le moment où il quitte le rassemblement et le fait qu'aucun remplacement supplémentaire n'est prévu à ce stade. La FFF indique également que le reste du groupe poursuit sa préparation selon le programme annoncé et qu'une nouvelle communication sera publiée si la situation évolue avant la prochaine rencontre. Ces éléments constituent la version primaire du dossier et permettent de distinguer la décision officielle des commentaires ou hypothèses publiés ailleurs.",
        sourceTier: "OFFICIAL",
        entities: ["France"],
        language: "fr",
      },
    ];
    const edition = buildEdition({ now: NOW, matches: [], signals });
    const news = edition.articles.find((article) => article.articleType === "news");
    assert.equal(news, undefined);
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

  it("does not turn a low-price match into a falsely authoritative Discover article", () => {
    const edition = buildEdition({ now: NOW, matches: board() });
    const senegal = edition.articles.find((article) => article.matchId === "sen");
    assert.equal(senegal, undefined, "a shallow fixture at a 1.30 price may remain in the match directory but is not a news article");
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

  it("rejects Premièrement Deuxièmement Troisièmement as an unstructured flat block", () => {
    const result = qualityGate(
      {
        articleType: "news",
        title: "UEFA : trois faits établis dans le dossier",
        h1: "UEFA : trois faits établis dans le dossier du jour",
        lead: "Cette analyse distingue les faits confirmés des interprétations et conserve chaque niveau de certitude dans une structure éditoriale explicite.",
        paragraphs: [
          {
            h2: "Ce qui est établi",
            body:
              "Premièrement, l’instance a reçu les documents transmis. Deuxièmement, les inspecteurs doivent encore les examiner. Troisièmement, aucune décision sur le fond n’est annoncée à ce stade.",
          },
          { h2: "Contexte", body: "Le contexte de la procédure est rappelé à partir des communications disponibles afin de ne pas transformer une étape procédurale en conclusion définitive. ".repeat(2) },
          { h2: "Positions", body: "Les positions des parties sont attribuées séparément et ne sont jamais présentées comme la position finale de l’instance compétente. ".repeat(2) },
          { h2: "Sources", body: "Les sources primaires et les confirmations journalistiques sont distinguées pour conserver un niveau de preuve lisible et vérifiable. ".repeat(2) },
          { h2: "Suite", body: "La prochaine mise à jour dépendra d’un nouvel élément officiel ou d’une décision procédurale identifiable et publiquement vérifiable. ".repeat(2) },
        ],
        sources: [
          { id: "official", label: "UEFA", status: "OFFICIAL", note: "communication officielle", url: "https://www.uefa.com/" },
          { id: "press", label: "EFE", status: "HIGH_CONFIDENCE", note: "agence de presse", url: "https://efe.com/" },
        ],
        image: { src: "/blog/discover/test-headings-adverbs.jpg", alt: "stade", width: 1600, height: 900, credit: "libre" },
        links: [{ href: "/la-liga", label: "La Liga" }],
        teams: ["Real Madrid", "FC Barcelona"],
        competition: "La Liga",
      },
      [],
    );
    assert.ok(result.reasons.includes("hiérarchie H2/H3 trop plate malgré des sous-idées explicites"));
  });

  it("rejects a flat H2 block when the copy explicitly contains three sub-ideas", () => {
    const flat = qualityGate(
      {
        articleType: "news",
        title: "Real Madrid : suivi médical et prochaines étapes",
        h1: "Real Madrid : suivi médical et prochaines étapes pour Mbappé",
        lead: "Cette analyse suit uniquement des éléments vérifiables et distingue les informations confirmées des étapes encore attendues dans le processus de récupération du joueur.",
        paragraphs: [
          {
            h2: "Trois signaux à surveiller",
            body:
              "Le premier sera le retour à l'entraînement collectif avec le groupe. Le deuxième sera une convocation officielle pour une rencontre du Real Madrid. Le troisième sera un nouveau communiqué médical ou une mise à jour du club sur sa disponibilité.",
          },
          { h2: "Contexte", body: "Le contexte médical reste encadré par les communications disponibles et ne permet pas d'inventer une date de retour. ".repeat(3) },
          { h2: "Calendrier", body: "Le calendrier sportif donne des repères mais ne remplace pas une validation médicale ni une convocation officielle. ".repeat(3) },
          { h2: "Sources", body: "Les éléments retenus proviennent de communications officielles ou de sources sportives identifiées et recoupées. ".repeat(3) },
          { h2: "Limites", body: "Les informations absentes sont conservées comme inconnues et ne sont pas transformées en certitudes éditoriales. ".repeat(3) },
        ],
        sources: [
          { id: "official", label: "Real Madrid", status: "OFFICIAL", note: "communication officielle", url: "https://www.realmadrid.com/" },
          { id: "press", label: "L'Équipe", status: "HIGH_CONFIDENCE", note: "source journalistique", url: "https://www.lequipe.fr/" },
        ],
        image: { src: "/blog/discover/test-headings.jpg", alt: "terrain de football", width: 1600, height: 900, credit: "libre" },
        links: [{ href: "/actualites/la-liga", label: "Actualités La Liga" }],
        teams: ["Real Madrid", "Kylian Mbappé"],
        competition: "La Liga",
      },
      [],
    );
    assert.ok(flat.reasons.includes("hiérarchie H2/H3 trop plate malgré des sous-idées explicites"));

    const structured = qualityGate(
      {
        articleType: "news",
        title: "Real Madrid : suivi médical et prochaines étapes",
        h1: "Real Madrid : suivi médical et prochaines étapes pour Mbappé",
        lead: "Cette analyse suit uniquement des éléments vérifiables et distingue les informations confirmées des étapes encore attendues dans le processus de récupération du joueur.",
        paragraphs: [
          {
            h2: "Trois signaux à surveiller",
            body: "Trois étapes vérifiables permettent de suivre le dossier sans transformer une estimation en certitude.",
            subsections: [
              { h3: "Retour à l'entraînement collectif", body: "Une séance complète avec le groupe serait un premier repère concret." },
              { h3: "Convocation officielle", body: "Une présence dans le groupe convoqué fournirait un deuxième repère sportif." },
              { h3: "Nouveau point médical", body: "Une communication du club apporterait le troisième repère utile." },
            ],
          },
          { h2: "Contexte", body: "Le contexte médical reste encadré par les communications disponibles et ne permet pas d'inventer une date de retour. ".repeat(3) },
          { h2: "Calendrier", body: "Le calendrier sportif donne des repères mais ne remplace pas une validation médicale ni une convocation officielle. ".repeat(3) },
          { h2: "Sources", body: "Les éléments retenus proviennent de communications officielles ou de sources sportives identifiées et recoupées. ".repeat(3) },
          { h2: "Limites", body: "Les informations absentes sont conservées comme inconnues et ne sont pas transformées en certitudes éditoriales. ".repeat(3) },
        ],
        sources: [
          { id: "official", label: "Real Madrid", status: "OFFICIAL", note: "communication officielle", url: "https://www.realmadrid.com/" },
          { id: "press", label: "L'Équipe", status: "HIGH_CONFIDENCE", note: "source journalistique", url: "https://www.lequipe.fr/" },
        ],
        image: { src: "/blog/discover/test-headings.jpg", alt: "terrain de football", width: 1600, height: 900, credit: "libre" },
        links: [{ href: "/actualites/la-liga", label: "Actualités La Liga" }],
        teams: ["Real Madrid", "Kylian Mbappé"],
        competition: "La Liga",
      },
      [],
    );
    assert.ok(!structured.reasons.includes("hiérarchie H2/H3 trop plate malgré des sous-idées explicites"));
  });


  it("never evicts an already-published URL when daily inventory exceeds three or the day changes", () => {
    // Four previously published high-quality articles stay available even
    // when the future-article gate rejects fresh generic match templates.
    const reference = manualEditorialArticles().find((article) => article.slug.includes("manchester-city-18-points"))!;
    const original = { ...reference, parisDate: parisDate(NOW), publishedAt: NOW.toISOString(), createdAt: NOW.toISOString(), modifiedAt: NOW.toISOString(), status: "PUBLISHED" as const };
    const extra = {
      ...original,
      id: "historical-extra",
      slug: "historical-extra-published-url",
      slot: "noon" as const,
    };
    const inventory = [original, extra, { ...original, id: "historical-three", slug: "historical-third-url", slot: "evening" as const }, { ...original, id: "historical-four", slug: "historical-fourth-url", slot: "noon" as const }];
    const sameDay = buildEdition({
      now: NOW,
      matches: board(),
      frozen: inventory,
    });
    assert.equal(sameDay.articles.length, 4);
    assert.ok(
      sameDay.articles.some((article) => article.slug === "historical-extra-published-url"),
      "a fourth already-published URL must never be pruned by the three-slot policy",
    );

    const nextDay = buildEdition({
      now: new Date("2026-09-26T17:00:00.000Z"),
      matches: [],
      frozen: sameDay.articles,
    });
    for (const article of sameDay.articles) {
      assert.ok(
        nextDay.articles.some((candidate) => candidate.slug === article.slug),
        `published URL disappeared across day boundary: ${article.slug}`,
      );
    }
    assert.ok(
      nextDay.slots.every(
        (slot) => !slot.article || slot.article.parisDate === nextDay.parisDate,
      ),
      "historical articles must not occupy today's publication slots",
    );
  });

});
import { editorialLiveWithinBudget } from "./live-budget.ts";

it("editorial live enrichment releases a stalled shared refresh without inventing matches", async () => {
  const result = await editorialLiveWithinBudget(() => new Promise(() => {}), 10);
  assert.deepEqual(result, { value: null, status: "TIMEOUT" });
});

it("editorial live enrichment preserves available data and reports unavailable providers", async () => {
  const snapshot = { matches: [{ id: "observed-match" }] };
  assert.deepEqual(await editorialLiveWithinBudget(async () => snapshot, 100), { value: snapshot, status: "AVAILABLE" });
  assert.deepEqual(await editorialLiveWithinBudget(async () => null, 100), { value: null, status: "UNAVAILABLE" });
  assert.deepEqual(await editorialLiveWithinBudget(async () => { throw new Error("provider unavailable"); }, 100), { value: null, status: "UNAVAILABLE" });
});

it("late live provider failures stay handled after the editorial deadline", async () => {
  let reject: (error: Error) => void = () => {};
  const pending = new Promise<null>((_resolve, rejectPromise) => { reject = rejectPromise; });
  assert.equal((await editorialLiveWithinBudget(() => pending, 10)).status, "TIMEOUT");
  reject(new Error("late provider failure"));
  await new Promise((resolve) => setImmediate(resolve));
});


describe("automatic publisher zero-cost evidence safety", () => {
  it("rejects aggregators, homepages and non-HTTPS links as attributable evidence", () => {
    assert.equal(publisherUrl("https://www.bbc.com/sport/football/articles/c1234"), true);
    assert.equal(publisherUrl("https://news.google.com/rss/articles/123"), false);
    assert.equal(publisherUrl("https://example.com/"), false);
    assert.equal(publisherUrl("http://example.com/article/123"), false);
    assert.equal(publisherUrl("https://127.0.0.1/article/123"), false);
    assert.equal(publisherUrl("https://localhost/article/123"), false);
    assert.equal(publisherUrl("https://example.com:8443/article/123"), false);
  });
});

describe("automatic publisher multilingual event correlation", () => {
  it("correlates English publisher stories into one sourced event without lowering source-count gates", () => {
    const date = "2026-10-24T09:15:00.000Z";
    const story = (id: string, title: string, source: string): EditorialNewsSignal => ({
      id,
      title,
      url: "https://" + source + "/football/arsenal-manager-report",
      sourceName: source,
      sourceUrl: "https://" + source,
      publishedAt: date,
      description: "Arsenal manager dismissal confirmed after Chelsea defeat.",
      sourceTier: "TIER1",
      entities: ["Arsenal", "Chelsea"],
      language: "en",
    });
    const rows = [
      story("bbc", "Arsenal manager sacked after Chelsea defeat", "bbc.com"),
      story("sky", "Arsenal sack manager after defeat to Chelsea", "skysports.com"),
      story("guardian", "Arsenal manager departure confirmed following Chelsea defeat", "theguardian.com"),
      { ...story("unrelated", "Liverpool transfer deal approved", "reuters.com"), entities: ["Liverpool"] },
    ];
    const clusters = clusterAutoReporterSignals(rows);
    const arsenal = clusters.find((cluster) => cluster.entities.includes("Arsenal"));
    assert.ok(arsenal, "English-language reporting must not be invisible to the publisher");
    assert.equal(arsenal.distinctSources, 3, "Three genuinely separate publisher names are required");
    assert.equal(arsenal.signals.length, 3, "An unrelated story must remain separate");
    assert.equal(arsenal.newsworthy, true);
    assert.equal(isAutoReporterMaterial("Arsenal manager departure confirmed"), true);
    assert.equal(clusters.reduce((sum, cluster) => sum + cluster.signals.length, 0), 4);
  });
});


describe("ASTRA editorial local model context budget", () => {
  it("joins the same named Clasico across languages without counting unrelated Real Madrid mentions", () => {
    const signal = (id: string, title: string, entities: string[], date: string) => ({ id, title, entities, publishedAt: date, sourceName: id, sourceTier: "TIER1", url: "https://"+id+".example.com/report", language: "en" } as EditorialNewsSignal);
    const rows = [
      signal("guardian", "Mbappé double secures Real Madrid late victory at Barcelona", ["Real Madrid", "Barcelone", "Kylian Mbappé"], "2026-10-25T22:00:00Z"),
      signal("rmc", "Barça-Real Madrid : le Real remporte le Clasico", ["Real Madrid", "Barcelone"], "2026-10-26T12:30:00Z"),
      signal("sky", "Mbappe's late strike earns Real Clasico glory at Barca", ["Real Madrid", "Barcelone"], "2026-10-26T09:00:00Z"),
      signal("unrelated", "Alex Freeman scores as Villarreal win", ["Real Madrid"], "2026-10-26T10:00:00Z"),
      signal("award", "Ballon d'Or : Real Madrid and Mbappé await the decision", ["Real Madrid", "Kylian Mbappé"], "2026-10-26T10:00:00Z"),
    ];
    const clusters = clusterAutoReporterSignals(rows);
    const clasico = clusters.find((c) => c.signals.some((s) => s.id === "guardian"))!;
    assert.equal(clasico.distinctSources, 3);
    assert.deepEqual(clasico.signals.map((s) => s.id).sort(), ["guardian", "rmc", "sky"]);
  });
  it("never treats a seeded slot ID or an operator catchup as scheduled generation proof", () => {
    const article = manualEditorialArticles()[0]!;
    assert.equal(hasAutomaticProof(article), false);
    const proof = { generator: "astra-auto-reporter-v2" as const, runId: "run-test", generatedAt: "2026-10-26T13:00:00Z", modelRequests: 7 };
    assert.equal(hasAutomaticProof({ ...article, generationProof: { ...proof, trigger: "operator-catchup" } }), false);
    assert.equal(hasAutomaticProof({ ...article, generationProof: { ...proof, trigger: "scheduler" }, status: "PUBLISHED" }), false, "A manual article cannot gain native provenance by adding seven-call metadata");
    assert.equal(hasAutomaticProof({ ...article, generationProof: { ...proof, trigger: "scheduler" }, status: "SCHEDULED" }), false);
  });
  it("counts a scheduled-agent catchup toward the three-page cap without spoofing native proof", () => {
    const seed = manualEditorialArticles().find((a) => a.parisDate === "2026-10-26")!;
    assert.ok(seed);
    const morning = { ...seed, id: "ed-2026-10-26-morning", slug: "quota-morning", slot: "morning" as const, status: "PUBLISHED" as const };
    const noon = { ...seed, id: "ed-2026-10-26-noon", slug: "quota-noon", slot: "noon" as const, status: "PUBLISHED" as const };
    const fallback = { ...seed, id: "manual-agent-catchup-2026-10-26-evening", slug: "quota-evening", slot: "evening" as const, status: "PUBLISHED" as const, generationProof: undefined };
    const duplicate = { ...fallback, id: "manual-duplicate" };
    const scheduled = { ...fallback, slug: "not-yet-public", status: "SCHEDULED" as const };
    const old = { ...fallback, slug: "yesterday", parisDate: "2026-10-25" };
    const publicToday = publishedTodayForQuota([morning, noon, fallback, duplicate, scheduled, old], "2026-10-26");
    assert.equal(publicToday.length, 3, "A fallback must consume the final daily publication slot");
    assert.deepEqual(publicToday.map((a) => a.slot).sort(), ["evening", "morning", "noon"]);
    assert.equal(hasAutomaticProof(fallback), false, "Fallback is not native Qwen output");
    assert.equal(Math.max(0, 3 - publicToday.length), 0, "No fourth article may be generated");
  });
  it("bounds publisher evidence for llama.cpp 2048-token requests without losing attribution", () => {
    const evidence = Array.from({ length: 4 }, (_, index) => ({
      signal: {
        id: "publisher-" + index,
        sourceName: "Official Publisher " + index,
        title: "Verified football news " + index,
        publishedAt: "2026-10-26T08:00:00Z",
        url: "https://publisher" + index + ".example.com/football/verified-report",
        sourceTier: "TIER1",
      } as EditorialNewsSignal,
      text: Array.from({ length: 80 }, (_, n) => "Verified passage " + n + " publisher " + index + ".").join(" "),
    }));
    const first = boundedEvidenceSlices(evidence, 0);
    const last = boundedEvidenceSlices(evidence, 6);
    assert.ok(first.length < 3400, "The model must not receive the former 20,000-character evidence prompt");
    assert.ok(last.length < 3400);
    assert.notEqual(first, last, "Each section must read a different part of the genuine publisher body");
    for (let n = 0; n < 4; n += 1) {
      assert.ok(first.includes("id=publisher-" + n), "Publisher attribution must be retained");
      assert.ok(last.includes("id=publisher-" + n));
    }
  });
});


describe("catch-up slot safety in Europe/Paris", () => {
  it("never makes 13 h or 19 h eligible before their actual deadline", () => {
    assert.deepEqual(eligiblePublishingSlots(new Date("2026-10-28T06:59:59Z")), []);
    assert.deepEqual(eligiblePublishingSlots(new Date("2026-10-28T07:00:00Z")), ["morning"]);
    assert.deepEqual(eligiblePublishingSlots(new Date("2026-10-28T10:05:00Z")), ["morning"]);
    assert.deepEqual(eligiblePublishingSlots(new Date("2026-10-28T12:00:00Z")), ["morning", "noon"]);
    assert.deepEqual(eligiblePublishingSlots(new Date("2026-10-28T18:00:00Z")), ["morning", "noon", "evening"]);
  });
});
