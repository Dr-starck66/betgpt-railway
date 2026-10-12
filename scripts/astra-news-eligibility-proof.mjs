#!/usr/bin/env node
// ASTRA News technical eligibility preflight; never asserts Google inclusion.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function inspectWiring(files) {
  const required = [
    ["scripts/run-editorial-publish.ts",["sourceIntegrityGate","contextualAuthorityGate","discoverLaunchpadStaticAudit","writeLedger"]],
    ["src/lib/editorial/source-integrity.ts",["sourceIntegrityGate"]],
    ["src/lib/editorial/authority-citations.ts",["contextualAuthorityGate"]],
    ["src/lib/editorial/discover-launchpad.ts",["discoverLaunchpadStaticAudit"]]
  ];
  return required.map(([path,needles])=>{
    const source=files[path]||"";
    const missing=needles.filter(needle=>!source.includes(needle));
    return {path,status:source && !missing.length?"WIRED":"FAIL",missing};
  });
}
export function classify({wiring,tests,publicProbe}) {
  if(wiring.some(x=>x.status!=="WIRED") || tests.some(x=>x.status!=="PASS")) return "FAIL";
  if(!publicProbe) return "PASS_SOURCE_TESTS_ONLY";
  if(publicProbe.status==="FAIL") return "FAIL";
  if(publicProbe.status==="PARTIAL_NO_RECENT_NEWS") return "PARTIAL_NO_RECENT_NEWS";
  return publicProbe.status==="PASS"?"PASS_PUBLIC_TECHNICAL":"UNVERIFIED";
}
function xmlValues(xml,tag) {
  const re=new RegExp("<"+tag+"(?:\\s[^>]*)?>([\s\S]*?)<\\/"+tag+">","gi");
  return [...xml.matchAll(re)].map(m=>m[1].trim().replace(/&amp;/g,"&"));
}
export function inspectNewsSitemap(xml,origin,now=Date.now()) {
  const entries=[...xml.matchAll(/<url>([\s\S]*?)<\/url>/gi)].map(m=>m[1]);
  const fresh=[],failures=[];
  if(!/<urlset\b/.test(xml))failures.push("missing-news-urlset");
  if(entries.length && !xml.includes("http://www.google.com/schemas/sitemap-news/0.9"))failures.push("missing-news-namespace");
  if(entries.length>1000)failures.push("news-sitemap-over-1000-entries");
  for(const entry of entries){
    const newsBlocks=[...entry.matchAll(/<news:news>([\s\S]*?)<\/news:news>/gi)].map(x=>x[1]);
    if(newsBlocks.length!==1){failures.push("invalid-news-block-count");continue;}
    const news=newsBlocks[0];
    const publicationBlocks=[...news.matchAll(/<news:publication>([\s\S]*?)<\/news:publication>/gi)].map(x=>x[1]);
    if(publicationBlocks.length!==1)failures.push("invalid-news-publication-count");
    const pub=publicationBlocks[0]||"";
    if(!xmlValues(pub,"news:name")[0])failures.push("missing-news-name");
    if(!/^[a-z]{2,3}$|^zh-(?:cn|tw)$/i.test(xmlValues(pub,"news:language")[0]||""))failures.push("invalid-news-language");
    if(!xmlValues(news,"news:title")[0])failures.push("missing-news-title");
    if(xmlValues(news,"news:publication_date").length!==1)failures.push("invalid-publication-date-count");
    const link=xmlValues(entry,"loc")[0]||"";
    const dates=xmlValues(entry,"news:publication_date");
    const publication=dates[0]||"";
    let url;
    try{url=new URL(link)}catch{failures.push("malformed-url");continue;}
    if(url.origin!==origin)failures.push("foreign-origin:"+url.hostname);
    const time=Date.parse(publication);
    if(!Number.isFinite(time)||time>now+60_000||now-time>48*3600_000)failures.push("invalid-news-age:"+link);
    else fresh.push(link);
  }
  return {status:failures.length?"FAIL":fresh.length?"PASS":"PARTIAL_NO_RECENT_NEWS",fresh,failures,entryCount:entries.length};
}
function runSuite(files){
  const argv=["--experimental-strip-types","--import","./scripts/ts-alias.mjs","--test",...files];
  const start=Date.now();
  const r=spawnSync(process.execPath,argv,{cwd:process.cwd(),encoding:"utf8",timeout:120000,maxBuffer:1024*1024});
  return {status:!r.error&&r.status===0?"PASS":"FAIL",exitCode:r.status,error:r.error?.message||null,
    files,durationMs:Date.now()-start,outputSha256:createHash("sha256").update((r.stdout||"")+(r.stderr||"")).digest("hex"),
    outputTail:((r.stdout||"")+(r.stderr||"")).slice(-600)};
}
async function publicSitemap(origin){
  try{
    const response=await fetch(origin+"/news-sitemap.xml",{headers:{accept:"application/xml,text/xml", "user-agent":"ASTRA-NEWS-ELIGIBILITY/1"},signal:AbortSignal.timeout(12000)});
    const body=await response.text();
    if(response.status!==200||!/xml/i.test(response.headers.get("content-type")||""))
      return{status:"FAIL",failures:["sitemap-http-or-content-type:"+response.status],httpStatus:response.status};
    return {...inspectNewsSitemap(body,origin),httpStatus:response.status};
  }catch(e){return{status:"FAIL",failures:["http-probe-error:"+String(e?.name||"unknown")]};}
}
async function main(){
  const paths=["scripts/run-editorial-publish.ts","src/lib/editorial/source-integrity.ts","src/lib/editorial/authority-citations.ts","src/lib/editorial/discover-launchpad.ts"];
  const sources=Object.fromEntries(paths.map(p=>[p,existsSync(p)?readFileSync(p,"utf8"):""]));
  const wiring=inspectWiring(sources);
  const tests=[runSuite(["src/lib/editorial/source-integrity.test.ts","src/lib/editorial/authority-citations.test.ts","src/lib/editorial/discover-launchpad.test.ts"])];
  const publicProbe=process.argv.includes("--public")?await publicSitemap("https://betgpt.live"):null;
  const status=classify({wiring,tests,publicProbe});
  const report={schema:"astra-news-eligibility-proof/v1",generatedAt:new Date().toISOString(),siteId:"betgpt.live",
    status,wiring,tests,publicProbe,
    inclusionInGoogleNews:"UNVERIFIED",
    caveat:"Technical source checks and sitemap HTTP never prove News or Discover inclusion. Search Console evidence is required separately."};
  const out=resolve("artifacts/astra-news-eligibility/proof.json");
  mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify(report,null,2)+"\n");
  console.log("ASTRA_NEWS_ELIGIBILITY",JSON.stringify({status,tests:tests.map(x=>x.status),wired:wiring.filter(x=>x.status==="WIRED").length,publicProbe:publicProbe?.status||"NOT_TESTED",report:"artifacts/astra-news-eligibility/proof.json"}));
  if(status==="FAIL"||status==="UNVERIFIED"||(process.argv.includes("--public")&&status!=="PASS_PUBLIC_TECHNICAL"))process.exitCode=1;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1]))await main();
