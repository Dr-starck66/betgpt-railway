import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { youtubeIdFromUrl, youtubeMatchSearchUrl, videoRelevance } from "../src/lib/serp/video.ts";

const sample = {home:{name:"Italie"},away:{name:"France"},competition:"Ligue des nations",kickoff:"2026-11-12T19:45:00Z",status:"finished"};

test("YouTube URL parsing accepts supported URLs and never arbitrary origins", () => {
  const id = "4-vipwrEgwM";
  for (const url of [
    `https://www.youtube.com/watch?v=${id}`,
    `https://youtu.be/${id}?si=123`,
    `https://www.youtube-nocookie.com/embed/${id}`,
    `https://youtube.com/live/${id}`,
    `https://youtube.com/shorts/${id}`,
  ]) assert.equal(youtubeIdFromUrl(url), id, url);
  for (const url of [
    "https://youtube.com.evil.test/watch?v=4-vipwrEgwM",
    "javascript:alert(1)",
    "http://youtube.com/watch?v=4-vipwrEgwM",
    "https://youtube.com/results?search_query=italie+france",
    "https://youtube.com/watch?v=invalid",
  ]) assert.equal(youtubeIdFromUrl(url), null, url);
});

test("Search URL works for any competition and includes the fixture and date", () => {
  const url = youtubeMatchSearchUrl(sample);
  const parsed = new URL(url);
  assert.equal(parsed.origin, "https://www.youtube.com");
  assert.equal(parsed.pathname, "/results");
  for (const token of ["Italie", "France", "Ligue des nations", "2026-11-12", "résumé"]) {
    assert.ok(parsed.searchParams.get("search_query")?.includes(token), token);
  }
  assert.ok(youtubeMatchSearchUrl({ ...sample, competition:"Premier League", status:"scheduled" }).includes("Premier"));
});

test("Mismatched or premature curated reactions are blocked", () => {
  const video = {
    videoId:"4-vipwrEgwM",title:"Italie France débrief",description:"Commentaire",channelName:"Paris Central",
    publishedAt:"2026-11-11T19:33:36Z",home:"Italie",away:"France",kickoffDay:"2026-11-12",
    kind:"reaction",official:false,
  };
  assert.equal(videoRelevance(video,sample).show,true);
  assert.equal(videoRelevance(video,{...sample,away:{name:"Espagne"}}).show,false);
  assert.equal(videoRelevance(video,{...sample,kickoff:"2026-11-13T19:45:00Z"}).show,false);
  assert.equal(videoRelevance(video,{...sample,status:"scheduled"}).show,false);
});

test("All leagues and dates remain available; old one-off placement is gone", () => {
  const news = readFileSync(new URL("../src/routes/actualites.index.tsx",import.meta.url),"utf8");
  const details = readFileSync(new URL("../src/components/match-answer.tsx",import.meta.url),"utf8");
  const directory = readFileSync(new URL("../src/components/youtube-match-directory.tsx",import.meta.url),"utf8");
  assert.match(news,/YouTubeMatchDirectory/);
  assert.doesNotMatch(news,/showItalieFranceDebrief|2026-11-15/);
  assert.match(details,/<MatchYouTubePanel id="video" match=\{match\}/);
  assert.match(directory,/ALL_LEAGUES/);
  assert.match(directory,/response\.total/);
  assert.match(directory,/customFixture/);
  assert.match(directory,/Toute compétition mondiale/);
});
