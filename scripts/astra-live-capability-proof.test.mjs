import test from "node:test";
import assert from "node:assert/strict";
import {assessHttp,classifyCapabilities,formatCapabilityAudit,maxBytes} from "./astra-live-capability-proof.mjs";
const html="<html><head></head><body>BetGPT football analyses</body></html>";
const goodHome=()=>assessHttp({url:"https://betgpt.live/",finalUrl:"https://betgpt.live/",
 status:200,contentType:"text/html; charset=utf-8",body:html,kind:"home"});
const goodRobots=()=>assessHttp({url:"https://betgpt.live/robots.txt",finalUrl:"https://betgpt.live/robots.txt",
 status:200,contentType:"text/plain",body:"User-agent: *\nAllow: /",kind:"robots"});
const goodSitemap=()=>assessHttp({url:"https://betgpt.live/sitemap.xml",finalUrl:"https://betgpt.live/sitemap.xml",
 status:200,contentType:"application/xml",body:"<urlset></urlset>",kind:"sitemap"});
const goodNews=()=>assessHttp({url:"https://betgpt.live/news-sitemap.xml",finalUrl:"https://betgpt.live/news-sitemap.xml",
 status:200,contentType:"application/xml",body:'<urlset xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"><url><loc>https://betgpt.live/actualites/test</loc><news:news><news:publication><news:name>BetGPT</news:name><news:language>fr</news:language></news:publication><news:publication_date>'+new Date().toISOString()+'</news:publication_date><news:title>Actualité de football vérifiée</news:title></news:news></url></urlset>',kind:"news"});
test("valid branded homepage over HTTPS yields runtime proof only",()=>{
 const h=goodHome();assert.equal(h.status,"PASS");assert.match(h.bodySha256,/^[a-f0-9]{64}$/);
 assert.deepEqual(classifyCapabilities({home:h}).verifiedCapabilities,["runtime"]);
});
test("HTTP 200 on a bot/error page does not count as BetGPT",()=>{
 const h=assessHttp({url:"https://betgpt.live/",finalUrl:"https://betgpt.live/",status:200,
 contentType:"text/html",body:"Cloudflare challenge",kind:"home"});
 assert.equal(h.status,"FAIL");assert.ok(h.failures.includes("brand-marker-missing"));
});
test("redirect to another host cannot satisfy proof",()=>{
 const h=assessHttp({url:"https://betgpt.live/",finalUrl:"https://phishing.example/",status:200,
 contentType:"text/html",body:html,kind:"home"});
 assert.equal(h.status,"FAIL");assert.ok(h.failures.includes("unexpected-origin-or-redirect"));
});
test("503 unavailable branded page is not valid",()=>{
 const h=assessHttp({url:"https://betgpt.live/",finalUrl:"https://betgpt.live/",status:503,
 contentType:"text/html",body:html,kind:"home"});
 assert.equal(h.status,"FAIL");
});
test("robots and sitemap are required for SEO capability",()=>{
 const p={home:goodHome(),robots:goodRobots(),sitemap:goodSitemap(),news:goodNews()};
 assert.deepEqual(classifyCapabilities(p).verifiedCapabilities,["runtime","seo","news"]);
 p.sitemap.status="FAIL";assert.deepEqual(classifyCapabilities(p).verifiedCapabilities,["runtime"]);
});
test("Google News sitemap existence is not proof of Google News inclusion",()=>{
 const p={home:goodHome(),robots:goodRobots(),sitemap:goodSitemap(),news:goodNews()};
 const r=formatCapabilityAudit(p,"2026-10-13T00:00:00.000Z");
 assert.equal(r.status,"PASS");assert.equal(r.sites.length,1);
 assert.equal(r.sites[0].evidence.httpStatus,200);
 assert.equal(r.sites[0].verifiedCapabilities.includes("news"),true);
 assert.match(r.note,/not deployment revision, uptime history/);
});
test("unknown response fails closed and never yields verified capabilities",()=>{
 const r=formatCapabilityAudit({home:{status:"UNVERIFIED",httpStatus:null}});
 assert.equal(r.status,"UNVERIFIED");assert.deepEqual(r.sites[0].verifiedCapabilities,[]);
});

test("ordinary valid multi-megabyte sitemaps must not get a false size failure",()=>{
 assert.equal(maxBytes("sitemap"),50*1024*1024);
 assert.equal(maxBytes("news"),50*1024*1024);
 assert.equal(maxBytes("home"),2*1024*1024);
 const huge="<urlset>"+(" ".repeat(1200000))+"</urlset>";
 const out=assessHttp({url:"https://betgpt.live/sitemap.xml",finalUrl:"https://betgpt.live/sitemap.xml",
   status:200,contentType:"application/xml",body:huge,kind:"sitemap"});
 assert.equal(out.status,"PASS",JSON.stringify(out.failures));
 assert.ok(out.bodyBytes>1024*1024);
});

test("an empty News sitemap cannot count as recent published news",()=>{
 const body='<urlset xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"></urlset>';
 const r=assessHttp({url:"https://betgpt.live/news-sitemap.xml",finalUrl:"https://betgpt.live/news-sitemap.xml",status:200,contentType:"application/xml",body,kind:"news"});
 assert.equal(r.status,"FAIL");
 assert.ok(r.failures.includes("news-no-article-entries"));
});
test("old or malformed article dates cannot count as fresh news",()=>{
 const body='<urlset xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"><url><loc>https://betgpt.live/actualites/test</loc><news:news><news:publication><news:name>BetGPT</news:name><news:language>fr</news:language></news:publication><news:publication_date>2020-01-01T00:00:00Z</news:publication_date><news:title>Ancienne information</news:title></news:news></url></urlset>';
 const r=assessHttp({url:"https://betgpt.live/news-sitemap.xml",finalUrl:"https://betgpt.live/news-sitemap.xml",status:200,contentType:"application/xml",body,kind:"news"});
 assert.equal(r.status,"FAIL");
 assert.ok(r.failures.includes("news-invalid-or-stale-date"));
});
