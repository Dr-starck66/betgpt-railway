import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { changelogDocument } from "@/lib/geo/changelog";
import { GEO_PAGES } from "@/lib/geo/entity";
import { publicEvidence } from "@/lib/geo/evidence-public";
import { geoHealth } from "@/lib/geo/health";
import { llmsTxt } from "@/lib/geo/llms";
import { fixtureIndexable, sitemapAllowed } from "@/lib/geo/quality";
import { citationReadiness } from "@/lib/geo/readiness";
import { crawlerProof } from "@/lib/geo/robots-audit";
import { geoJsonLd, validateJsonLd } from "@/lib/geo/schema";
import { visibilitySeed } from "@/lib/geo/visibility";

describe("geo spotlight", () => {
  it("lets useful crawlers read public pages and blocks private ones", () => {
    const proof = crawlerProof();
    assert.equal(proof.length, 4);
    for (const row of proof) {
      assert.equal(row.importantOpen, true, row.agent);
      assert.equal(row.privateClosed, true, row.agent);
    }
  });

  it("validates entity JSON-LD and keeps a citation checklist", () => {
    for (const doc of GEO_PAGES) {
      const check = validateJsonLd(geoJsonLd(doc));
      assert.equal(check.ok, true, check.errors.join(","));
      const ready = citationReadiness({
        title: doc.title,
        description: doc.description,
        h1: doc.h1,
        canonical: `https://betgpt.live${doc.path}`,
        updated: doc.updated,
        body: doc.answer + doc.sections.map((s) => s.paragraphs.join(" ")).join(" "),
        jsonLd: true,
        indexable: true,
        internalLinks: doc.links.length,
        hasSourceNote: true,
      });
      assert.ok(ready.score >= 80, `${doc.path} ${ready.score}`);
    }
  });

  it("does not invent AI citations or ticket scores", () => {
    const seed = visibilitySeed();
    assert.ok(seed.every((row) => row.mentioned === null && row.checkedAt === null));
    const evidence = publicEvidence([
      {
        id: "t1",
        matchId: "m1",
        kickoff: "2026-09-01T18:00:00.000Z",
        home: "A",
        away: "B",
        market: "1X2_H",
        label: "A",
        odds: 2,
        book: "Unibet",
        stakePct: 1,
        modelProb: 0.5,
        ev: 0,
        dailyBest: false,
        kind: "prono",
        decision: "NO_BET",
        recordedAt: "2026-09-01T10:00:00.000Z",
      },
    ]);
    assert.equal(evidence[0]?.goalsHome, null);
    assert.equal(evidence[0]?.result, null);
  });

  it("keeps thin fixtures and private paths out of the public sitemap filter", () => {
    assert.equal(fixtureIndexable({ home: { name: "" }, away: { name: "B" }, kickoff: "2026-09-01T00:00:00Z" }).index, false);
    assert.equal(fixtureIndexable({ home: { name: "A" }, away: { name: "B" }, kickoff: "2026-09-01T00:00:00Z" }).index, true);
    for (const page of GEO_PAGES) assert.equal(sitemapAllowed(page.path), true, page.path);
    assert.equal(sitemapAllowed("/lab"), false);
    assert.equal(sitemapAllowed("/admin"), false);
    assert.equal(sitemapAllowed("/api/x"), false);
    assert.equal(sitemapAllowed("/geo-health"), false);
    assert.ok(llmsTxt().includes("https://betgpt.live/methodology"));
    assert.match(llmsTxt(), /ne garantit/);
    assert.equal(changelogDocument().updated, "2026-09-23");
    const health = geoHealth();
    assert.equal(health.find((row) => row.id === "Robots")?.status, "PASS");
    assert.equal(health.find((row) => row.id === "Schema")?.status, "PASS");
    assert.equal(health.find((row) => row.id === "HTTP live")?.status, "UNVERIFIED");
    assert.notEqual(health.find((row) => row.id === "AI monitor")?.status, "PASS");
  });
});
