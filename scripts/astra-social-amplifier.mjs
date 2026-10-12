import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
const CONFIG="config/astra-social-sites.json", STATE="data/social/amplifier-state.json";
const hash=s=>createHash("sha256").update(s).digest("hex").slice(0,18);
const now=()=>new Date().toISOString();
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const decode=s=>String(s||"").replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/,"$1").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'");
const blocks=(s,t)=>[...s.matchAll(new RegExp("<"+t+"\\b[^>]*>([\\s\\S]*?)<\\/"+t+"\\s*>","gi"))].map(m=>m[1]);
const tag=(s,t)=>decode((s.match(new RegExp("<"+t+"\\b[^>]*>([\\s\\S]*?)<\\/"+t+"\\s*>","i"))||[])[1]||"").trim();

export function parseFeed(xml){
 const items=[];
 for(const s of blocks(xml,"item"))items.push({url:tag(s,"link"),title:tag(s,"title"),date:tag(s,"pubDate")||tag(s,"dc:date"),kind:"feed"});
 for(const s of blocks(xml,"entry"))items.push({url:decode((s.match(/<link\b[^>]*\bhref=["']([^"']+)/i)||[])[1]||tag(s,"link")),title:tag(s,"title"),date:tag(s,"published")||tag(s,"updated"),kind:"feed"});
 for(const s of blocks(xml,"url"))items.push({url:tag(s,"loc"),title:tag(s,"news:title"),date:tag(s,"news:publication_date")||tag(s,"lastmod"),kind:/<news:news\b/i.test(s)?"news":"sitemap"});
 const submaps=blocks(xml,"sitemap").map(s=>tag(s,"loc")).filter(s=>/news|post|article/i.test(s)).slice(0,8);
 const valid=/<(?:rss|feed|urlset|sitemapindex)\b/i.test(xml);
 return {items,submaps,valid};
}
export function sourceAllowed(raw,site){
 try{const u=new URL(raw),s=new URL(site.siteUrl);return u.protocol==="https:"&&u.hostname.replace(/^www\./,"")===s.hostname.replace(/^www\./,"")&&!/\/(?:tag|category|author|search|page)\//i.test(u.pathname);}
 catch{return false;}
}
export const recent=(s,t=Date.now())=>Number.isFinite(Date.parse(s||""))&&t-Date.parse(s)>=-900000&&t-Date.parse(s)<=259200000;
const token=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9]/g,"");
export function hashtags(title,site,n){
 const seen=new Set(),out=[];
 for(const v of [...(site.keywords||[]),...String(title).split(/\s+/).filter(w=>w.length>5).slice(0,5)]){
  const t=token(v),k=t.toLowerCase();if(t.length<4||t.length>28||seen.has(k))continue;seen.add(k);out.push("#"+t);
 }
 return out.slice(0,n==="instagram"?6:2);
}
export function compose(a,site,n){
 const url=new URL(a.url);url.searchParams.set("utm_source",n==="x"?"twitter":"instagram");url.searchParams.set("utm_medium","social");url.searchParams.set("utm_campaign","astra_social_auto");
 const suffix=url.toString()+"\n"+hashtags(a.title,site,n).join(" ");
 if(n==="x")return (String(a.title).slice(0,Math.max(15,278-suffix.length))+"\n"+suffix).slice(0,280);
 return [String(a.title).slice(0,160),String(a.description||"").slice(0,480),suffix].filter(Boolean).join("\n\n").slice(0,2000);
}
const getMeta=(html,key)=>{
 for(const m of html.matchAll(/<meta\b[^>]*>/gi)){
  const attrs={};for(const a of m[0].matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g))attrs[a[1].toLowerCase()]=a[2];
  if(attrs.property?.toLowerCase()===key||attrs.name?.toLowerCase()===key)return decode(attrs.content||"");
 }
 return "";
};
async function load(url){
 const r=await fetch(url,{headers:{"user-agent":"AstraSocialAmplifier/1.0"},signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw Error("HTTP "+r.status);return {url:r.url,type:r.headers.get("content-type")||"",body:await r.text()};
}
async function articleData(url,site){
 const p=await load(url);if(!sourceAllowed(p.url,site))throw Error("article origin mismatch");
 if(!/(html|text\/plain|^$)/i.test(p.type))throw Error("article not HTML");
 if(/<meta[^>]+noindex/i.test(p.body))throw Error("noindex");
 const title=getMeta(p.body,"og:title")||getMeta(p.body,"twitter:title")||decode((p.body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]);
 if(!title)throw Error("missing article title");
 const rawImage=getMeta(p.body,"og:image")||getMeta(p.body,"twitter:image");let imageUrl=null;
 try{const img=new URL(rawImage,p.url);if(rawImage&&img.protocol==="https:")imageUrl=img.href;}catch{}
 return {url:p.url,title,description:getMeta(p.body,"og:description")||getMeta(p.body,"description"),imageUrl};
}
async function discover(site){
 const all=[],visited=new Set(),errors=[];let verified=0;
 async function visit(url,depth=0){
  if(visited.has(url)||visited.size>18)return;visited.add(url);
  try{
   const r=await load(url);if(!sourceAllowed(r.url,site))throw Error("off-domain feed");
   const feed=parseFeed(r.body);if(!feed.valid)throw Error("invalid XML feed");
   verified++;
   for(const v of feed.items){
    if(!sourceAllowed(v.url,site)||!recent(v.date))continue;
    if(site.articlePath&&!new URL(v.url).pathname.startsWith(site.articlePath))continue;
    if(v.kind==="sitemap"&&!site.articlePath)continue;
    all.push(v);
   }
   if(depth<2)for(const s of feed.submaps)if(sourceAllowed(s,site))await visit(s,depth+1);
  }catch(e){errors.push(url+": "+String(e.message||e).slice(0,50));}
 }
 for(const path of (site.feeds||[]).slice(0,5))await visit(new URL(path,site.siteUrl).href);
 return {verified,items:[...new Map(all.map(v=>[v.url,v])).values()].slice(0,200),errors};
}
export function planItems(state,site,items,stamp=now()){
 const prev=state.sites[site.id],bootstrapping=!prev?.bootstrapped,seen=prev?.seen||{};
 const fresh=items.filter(v=>!seen[hash(v.url)]);
 for(const v of fresh)seen[hash(v.url)]={url:v.url,date:v.date,seenAt:stamp};
 state.sites[site.id]={bootstrapped:true,lastCheckedAt:stamp,seen};
 return {bootstrapping,fresh:bootstrapping?[]:fresh};
}
async function plan(state,sites){
 for(const site of sites){
  const found=await discover(site);
  if(!found.verified){console.log(JSON.stringify({site:site.id,status:"BLOCKED_SOURCE",errors:found.errors.slice(0,2)}));continue;}
  const p=planItems(state,site,found.items);let jobs=0;
  for(const candidate of p.fresh){
   let article;try{article=await articleData(candidate.url,site);}
   catch(e){console.log(JSON.stringify({site:site.id,status:"BLOCKED_ARTICLE",url:candidate.url,error:String(e.message||e)}));continue;}
   for(const network of ["instagram","x"]){
    const id=network+":"+hash(candidate.url);if(state.jobs[id])continue;
    state.jobs[id]={id,siteId:site.id,network,articleUrl:article.url,
     imageUrl:article.imageUrl,text:compose(article,site,network),createdAt:now(),
     status:network==="x"?"WAIT_X_COST":site.instagramReview?"WAIT_REVIEW":article.imageUrl?"WAIT_AUTH":"WAIT_IMAGE",
     remoteId:null,remoteUrl:null,claimedRunId:null,error:null};jobs++;
   }
  }
  console.log(JSON.stringify({site:site.id,status:p.bootstrapping?"BASELINED":"PLANNED",verifiedSources:found.verified,newArticles:p.fresh.length,jobsCreated:jobs,errors:found.errors.slice(0,2)}));
 }
}
function accounts(){
 try{const a=JSON.parse(process.env.ASTRA_SOCIAL_META_ACCOUNTS_JSON||"{}");if(typeof a!=="object"||!a)throw Error();return a;}
 catch{throw Error("ASTRA_SOCIAL_META_ACCOUNTS_JSON is not valid JSON");}
}
function claim(state,sites){
 const auth=accounts(),run=process.env.GITHUB_RUN_ID||"manual";let count=0;
 for(const j of Object.values(state.jobs)){
  if(j.network!=="instagram"||!["WAIT_AUTH","WAIT_IMAGE"].includes(j.status))continue;
  const site=sites.find(s=>s.id===j.siteId),a=auth[j.siteId]?.instagram;
  if(!site||site.instagramReview||!j.imageUrl||!a?.accountId||!a?.accessToken)continue;
  j.status="CLAIMED";j.claimedRunId=run;j.claimedAt=now();count++;
 }
 console.log("ASTRA_SOCIAL_CLAIMED "+count);
}
async function api(url,options){
 const r=await fetch(url,{...options,signal:AbortSignal.timeout(15000)});
 const body=await r.json().catch(()=>({}));
 if(!r.ok||body.error)throw Error("META_HTTP_"+r.status+"_"+(body.error?.code||"unknown"));
 return body;
}
async function instagram(j,a){
 const root="https://graph.facebook.com/v24.0/",token=a.accessToken,ig=encodeURIComponent(a.accountId);
 const container=await api(root+ig+"/media",{method:"POST",body:new URLSearchParams({image_url:j.imageUrl,caption:j.text,access_token:token})});
 if(!container.id)throw Error("META_NO_MEDIA_CONTAINER");
 let ready=false;
 for(let i=0;i<6;i++){
  const r=await api(root+encodeURIComponent(container.id)+"?"+new URLSearchParams({fields:"status_code",access_token:token}));
  if(r.status_code==="FINISHED"){ready=true;break;}
  if(["ERROR","EXPIRED"].includes(r.status_code))throw Error("META_CONTAINER_ERROR");
  await new Promise(r=>setTimeout(r,1600));
 }
 if(!ready)throw Error("META_CONTAINER_TIMEOUT");
 const p=await api(root+ig+"/media_publish",{method:"POST",body:new URLSearchParams({creation_id:container.id,access_token:token})});
 if(!p.id)throw Error("META_PUBLISH_NO_ID");
 try{
  const v=await api(root+encodeURIComponent(p.id)+"?"+new URLSearchParams({fields:"id,permalink",access_token:token}));
  if(v.id===p.id&&/^https:\/\/www\.instagram\.com\//.test(v.permalink||""))return {status:"PUBLISHED",remoteId:p.id,remoteUrl:v.permalink};
 }catch{}
 return {status:"REMOTE_UNVERIFIED",remoteId:p.id,remoteUrl:null};
}
async function deliver(state){
 const auth=accounts(),run=process.env.GITHUB_RUN_ID||"manual";
 for(const j of Object.values(state.jobs)){
  if(j.status!=="CLAIMED"||j.claimedRunId!==run)continue;
  try{
   const a=auth[j.siteId]?.instagram;if(!a?.accountId||!a?.accessToken)throw Error("MISSING_AUTH");
   Object.assign(j,await instagram(j,a));j.error=null;
  }catch(e){j.status="NEEDS_RECONCILIATION";j.error=String(e.message||e).slice(0,150);}
  j.finishedAt=now();
  console.log(JSON.stringify({site:j.siteId,status:j.status,remoteUrl:j.remoteUrl,error:j.error}));
 }
}
async function main(){
 const step=process.argv[2];if(!["plan","claim","deliver"].includes(step))throw Error("expected plan|claim|deliver");
 const state=JSON.parse(readFileSync(STATE,"utf8")),config=JSON.parse(readFileSync(CONFIG,"utf8"));
 if(!state.sites||!state.jobs||!Array.isArray(config.sites))throw Error("INVALID_STATE");
 if(step==="plan")await plan(state,config.sites);
 if(step==="claim")claim(state,config.sites);
 if(step==="deliver")await deliver(state);
 writeFileSync(STATE,JSON.stringify(state,null,2)+"\n");
 const counts={};for(const j of Object.values(state.jobs))counts[j.status]=(counts[j.status]||0)+1;
 const report="### ASTRA SOCIAL "+step+"\n"+JSON.stringify(counts)+"\n\nPublishing on Google Discover is not inferred.\n";
 console.log(report);if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,report);
}
if(process.argv[1]===fileURLToPath(import.meta.url))main().catch(e=>{console.error("ASTRA_SOCIAL_FAIL",String(e.message||e));process.exitCode=1;});
