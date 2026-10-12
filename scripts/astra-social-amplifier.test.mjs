import test from "node:test";
import assert from "node:assert/strict";
import {parseFeed,sourceAllowed,recent,hashtags,compose,planItems} from "./astra-social-amplifier.mjs";
const site={id:"betgpt",siteUrl:"https://betgpt.live",articlePath:"/actualites/",keywords:["football","Ligue1"]};
test("RSS extraction and dates",()=>{
 const p=parseFeed('<rss><channel><item><title><![CDATA[Match gagnant]]></title><link>https://betgpt.live/actualites/a</link><pubDate>Mon, 12 Oct 2026 12:00:00 GMT</pubDate></item></channel></rss>');
 assert.equal(p.valid,true);assert.equal(p.items.length,1);assert.equal(p.items[0].title,"Match gagnant");
});
test("News sitemap extraction",()=>{
 const p=parseFeed('<urlset><url><loc>https://betgpt.live/actualites/b</loc><news:news><news:publication_date>2026-10-12</news:publication_date><news:title>Une actualite</news:title></news:news></url></urlset>');
 assert.equal(p.items[0].kind,"news");assert.equal(p.items[0].title,"Une actualite");
});
test("No off-site or HTTP publication",()=>{
 assert.equal(sourceAllowed("https://betgpt.live/actualites/a",site),true);
 assert.equal(sourceAllowed("http://betgpt.live/actualites/a",site),false);
 assert.equal(sourceAllowed("https://betgpt.live.evil.test/actualites/a",site),false);
});
test("Date freshness gate",()=>{
 const x=Date.now();assert.equal(recent(new Date(x-60000).toISOString(),x),true);
 assert.equal(recent(new Date(x-1000*60*60*80).toISOString(),x),false);
});
test("Hashtags are de-duplicated and network-length bound",()=>{
 assert.ok(hashtags("Ligue1 Ligue1 football",site,"x").length<=2);
 assert.ok(hashtags("Ligue1 Ligue1 football",site,"instagram").length<=6);
});
test("Social copy is localized, tracked and 280-char bounded for X",()=>{
 const a={url:"https://betgpt.live/actualites/test",title:"Football ".repeat(50),description:"Dossier"};
 const x=compose(a,site,"x"),ig=compose(a,site,"instagram");
 assert.ok(x.length<=280);assert.match(x,/utm_source=twitter/);
 assert.match(ig,/utm_source=instagram/);assert.match(ig,/#Ligue1/);
});
test("Bootstrap does not blast old articles and does not repeat",()=>{
 const state={schema:1,sites:{},jobs:{}}, a={url:"https://betgpt.live/actualites/one",date:"2026-10-12"};
 const first=planItems(state,site,[a]);
 assert.equal(first.bootstrapping,true);assert.equal(first.fresh.length,0);
 const second=planItems(state,site,[a]);
 assert.equal(second.fresh.length,0);
 const b={...a,url:"https://betgpt.live/actualites/two"};
 assert.equal(planItems(state,site,[a,b]).fresh.length,1);
 assert.equal(planItems(state,site,[a,b]).fresh.length,0);
});
