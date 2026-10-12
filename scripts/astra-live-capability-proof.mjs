#!/usr/bin/env node
/** One-shot external BetGPT probe. No secrets, no server changes, no production writes. */
import {readFileSync,mkdirSync,writeFileSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {createHash} from "node:crypto";
import {pathToFileURL} from "node:url";
const sha=b=>createHash("sha256").update(b).digest("hex");
const ORIGIN="https://betgpt.live";
export function maxBytes(kind){
 if(kind==="sitemap"||kind==="news")return 50*1024*1024;
 if(kind==="robots")return 512*1024;
 return 2*1024*1024;
}
export function assessHttp({url,finalUrl,status,contentType,body,kind}){
 const failures=[];
 try{
  const req=new URL(url),fin=new URL(finalUrl);
  if(req.protocol!=="https:"||req.origin!==ORIGIN||fin.origin!==ORIGIN)failures.push("unexpected-origin-or-redirect");
 }catch{failures.push("invalid-url");}
 if(status!==200)failures.push("http-not-200");
 if(kind==="home"){
  if(!/text\/html/i.test(contentType||""))failures.push("not-html");
  if(!/BetGPT/i.test(body||""))failures.push("brand-marker-missing");
  if(/<meta[^>]*name=["']robots["'][^>]*noindex/i.test(body||""))failures.push("home-noindex");
 }
 if(kind==="robots"){
  if(!/(User-agent|Sitemap:)/i.test(body||""))failures.push("robots-text-unexpected");
  if(!/text\/plain/i.test(contentType||""))failures.push("robots-content-type");
 }
 if(kind==="sitemap"){
  if(!/(<urlset\b|<sitemapindex\b)/i.test(body||""))failures.push("sitemap-xml-missing");
  if(!/(xml|text\/plain)/i.test(contentType||""))failures.push("sitemap-content-type");
 }
 if(kind==="news"){
  if(!/<urlset\b/i.test(body||""))failures.push("news-urlset-missing");
  if(!/www\.google\.com\/schemas\/sitemap-news\/0\.9/i.test(body||""))failures.push("news-namespace-missing");
 }
 if(Buffer.byteLength(body||"","utf8")>maxBytes(kind))failures.push("response-over-limit");
 return {status:failures.length?"FAIL":"PASS",failures,finalUrl,httpStatus:status,
    contentType,bodySha256:sha(Buffer.from(body||"","utf8")),bodyBytes:Buffer.byteLength(body||"","utf8")};
}
export function classifyCapabilities(probes){
 const home=probes.home;
 const runtime=home?.status==="PASS";
 const seo=runtime&&probes.robots?.status==="PASS"&&probes.sitemap?.status==="PASS";
 const news=seo&&probes.news?.status==="PASS";
 return {status:runtime?"PASS":"UNVERIFIED",verifiedCapabilities:[
   ...(runtime?["runtime"]:[]),
   ...(seo?["seo"]:[]),
   ...(news?["news"]:[])
 ],reason:runtime?"public-html-200-brand-verified":"homepage-proof-failed",
   homePass:runtime,seoPass:seo,newsSitemapPass:news};
}
async function request(path,kind){
 const url=ORIGIN+path;
 try{
  const response=await fetch(url,{redirect:"follow",
   headers:{"user-agent":"ASTRA-CAPABILITY-READONLY/1.0",accept:"*/*","cache-control":"no-cache"},
   signal:AbortSignal.timeout(12000)});
  const limit=maxBytes(kind);
  const advertised=Number(response.headers.get("content-length")||0);
  if(advertised>limit)return {status:"FAIL",httpStatus:response.status,failures:["response-over-limit"],bodyBytes:advertised};
  const reader=response.body?.getReader();
  const chunks=[];let length=0;
  if(reader){
   while(true){
    const part=await reader.read();
    if(part.done)break;
    length+=part.value.byteLength;
    if(length>limit){
     await reader.cancel().catch(()=>{});
     return {status:"FAIL",httpStatus:response.status,failures:["response-over-limit"],bodyBytes:length};
    }
    chunks.push(Buffer.from(part.value));
   }
  }
  const body=Buffer.concat(chunks).toString("utf8");
  return assessHttp({url,finalUrl:response.url,status:response.status,
    contentType:response.headers.get("content-type")||"",body,kind});
 }catch(err){return{status:"UNVERIFIED",failures:["network-error:"+String(err?.cause?.code||err?.name||"unknown")],
    httpStatus:null,bodySha256:null};}
}
export function formatCapabilityAudit(probes,now=new Date().toISOString()){
 const caps=classifyCapabilities(probes);
 return {schema:"astra-site-capabilities/live-v1",generatedAt:now,
   status:caps.status,sites:[{siteId:ORIGIN,status:caps.status,
    verifiedCapabilities:caps.verifiedCapabilities,
    evidence:{status:probes.home?.status||"UNVERIFIED",
      httpStatus:probes.home?.httpStatus||null,
      bodySha256:probes.home?.bodySha256||null,
      value:caps.homePass?1:0,
      observedAt:now},
    probes,reasons:caps.status==="PASS"?[]:[caps.reason]}],
   note:"Proof of observed public HTTP surfaces only; not deployment revision, uptime history, editorial outcome, or Google indexing"};
}
async function main(){
 const probes={home:await request("/","home"),robots:await request("/robots.txt","robots"),
   sitemap:await request("/sitemap.xml","sitemap"),news:await request("/news-sitemap.xml","news")};
 const audit=formatCapabilityAudit(probes);
 const out=resolve("artifacts/astra-capabilities/live.json");
 mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify(audit,null,2)+"\n");
 // Exactly one fresh observation: never claim repeated samples to satisfy optimizer thresholds.
 const h=audit.sites[0].evidence;
 const metricStatus=h.status==="PASS"?"PASS":"UNVERIFIED";
 const observationFile=resolve("artifacts/astra-optimizer/runtime-single-probe.json");
 const metric={schema:"astra-single-probe/v1",status:metricStatus,metric:h.value,
   observedAt:audit.generatedAt,httpStatus:h.httpStatus,sourceSha256:h.bodySha256,
   sampleCount:1};
 mkdirSync(dirname(observationFile),{recursive:true});const serialized=JSON.stringify(metric,null,2)+"\n";
 writeFileSync(observationFile,serialized);
 const observation={schema:"astra-optimizer/observations-v1",observations:[{
   id:"betgpt-runtime-public-one-probe",siteId:ORIGIN,brickId:"ASTRA_HEALTH_GATE",
   metric:"runtime_success_rate",value:h.value,samples:1,verified:metricStatus==="PASS",
   observedAt:audit.generatedAt,evidenceFile:"artifacts/astra-optimizer/runtime-single-probe.json",
   pointer:"/metric",proofPointer:"/status",fileSha256:sha(Buffer.from(serialized))
 }]};
 const obsFile=resolve("artifacts/astra-optimizer/observations.json");
 writeFileSync(obsFile,JSON.stringify(observation,null,2)+"\n");
 console.log("ASTRA_LIVE_CAPABILITY",JSON.stringify({status:audit.status,
   capabilities:audit.sites[0].verifiedCapabilities,
   homeHttpStatus:h.httpStatus,homeSha256:h.bodySha256,
   runtimeSamples:1,
   robots:{status:probes.robots.status,httpStatus:probes.robots.httpStatus||null,failures:probes.robots.failures||[]},
   sitemap:{status:probes.sitemap.status,httpStatus:probes.sitemap.httpStatus||null,failures:probes.sitemap.failures||[]},
   newsSitemap:{status:probes.news.status,httpStatus:probes.news.httpStatus||null,failures:probes.news.failures||[]},report:"artifacts/astra-capabilities/live.json"}));
 if(audit.status!=="PASS")process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await main();
