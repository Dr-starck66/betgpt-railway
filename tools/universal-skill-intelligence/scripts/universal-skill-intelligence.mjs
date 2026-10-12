#!/usr/bin/env node
// UNIVERSAL SKILL INTELLIGENCE Omega: read-only; no installs, paid APIs or arbitrary code execution.
import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {pathToFileURL} from "node:url";

const registry="https://skills.sh", github="https://api.github.com";
export const policy=Object.freeze({autoInstall:false,executeRemoteCode:false,paidServices:false,credentialsInReports:false});
const trusted=new Set(["vercel-labs","microsoft","anthropics","github","openai"]);
const safeName=/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,99}$/;
const clean=s=>String(s||"").replace(/[\u0000-\u001f\u007f<>]/g," ").slice(0,160).trim();

export function normalize(data){
  // Official skills CLI /api/search returns {skills:[]}; also accepts array and {data:[]} for defensive compatibility.
  const entries=Array.isArray(data)?data:Array.isArray(data?.skills)?data.skills:Array.isArray(data?.data)?data.data:null;
  if(!entries)throw Error("INVALID_API_RESPONSE");
  const result=[],seen=new Set();
  for(const s of entries){
    const src=typeof s.source==="string"?s.source.replace(/^https:\/\/github\.com\//i,"").replace(/\.git$/i,""):"";
    const [owner,repo,...extra]=src.split("/");
    const id=typeof s.id==="string"?s.id:"";
    const name=clean(s.name);
    // skills.sh returns id as the short skill slug (e.g. "find-skills"), not necessarily owner/repo/id.
    // Reject inconsistent slash paths rather than silently substituting the displayed title.
    if(id.includes("/")&&!id.startsWith(src+"/"))continue;
    const slug=id ? (id.startsWith(src+"/") ? id.slice(src.length+1) : id)
      : typeof s.slug==="string"&&s.slug ? clean(s.slug) : name;
    if(extra.length||![owner,repo,slug].every(v=>safeName.test(v))||!name)continue;
    const key=(src+"/"+slug).toLowerCase();
    if(seen.has(key))continue;
    seen.add(key);
    result.push({id:src+"/"+slug,name,source:src,installs:Number.isSafeInteger(s.installs)&&s.installs>=0?s.installs:0,
      skillUrl:registry+"/"+src+"/"+slug,repoUrl:"https://github.com/"+src});
  }
  return result;
}
export function auditText(text){
  if(typeof text!=="string"||!text.length||text.length>100000)return {status:"UNVERIFIED",reason:"missing-or-oversized-document"};
  const rules={
    "remote-shell-pipe":/(?:curl|wget)\s+[^\r\n|]{1,300}\|\s*(?:ba)?sh\b/i,
    "destructive-shell":/\brm\s+-[a-z]*r[a-z]*f\b|\brm\s+-[a-z]*f[a-z]*r\b/i,
    "prompt-override":/ignore (?:all )?(?:previous|prior|system) instructions/i,
    "possible-secret-exfiltration":/(?:\.env|GITHUB_TOKEN|OPENAI_API_KEY|AWS_SECRET_ACCESS_KEY)[^\n]{0,180}(?:curl|webhook|upload|post)/i
  };
  const flags=Object.entries(rules).filter(([,regex])=>regex.test(text)).map(([key])=>key);
  return flags.length?{status:"RISK_DETECTED",flags}:{status:"CLEAN_STATIC_SCAN",note:"Not a security certification"};
}
async function request(url,fetcher,ms){
  const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),ms);
  const headers={Accept:"application/json","User-Agent":"universal-skill-intelligence-omega/1"};
  if(url.startsWith(github+"/")&&process.env.GITHUB_TOKEN)headers.Authorization="Bearer "+process.env.GITHUB_TOKEN;
  try{
    const resp=await fetcher(url,{headers,signal:controller.signal});
    if(!resp.ok)throw Error("HTTP_"+resp.status);
    return await resp.json();
  }finally{clearTimeout(timer);}
}
export function score(skill){
  let n=Math.min(35,Math.floor(Math.log10(1+skill.installs)*8));
  if(trusted.has(skill.source.split("/")[0].toLowerCase()))n+=20;
  if(skill.repo?.verified)n+=Math.min(35,Math.floor(Math.log10(1+skill.repo.stars)*10));
  if(skill.repo?.archived)n-=35;
  if(skill.audit?.status==="CLEAN_STATIC_SCAN")n+=10;
  if(skill.audit?.status==="RISK_DETECTED")n=0;
  return Math.max(0,Math.min(100,n));
}
async function verify(skill,fetcher,ms){
  try{
    const r=await request(github+"/repos/"+skill.source,fetcher,ms);
    if(!r||typeof r.full_name!=="string"||r.full_name.toLowerCase()!==skill.source.toLowerCase()||r.private===true)throw Error("REPO_IDENTITY_MISMATCH");
    skill.repo={verified:true,stars:Number.isSafeInteger(r.stargazers_count)?r.stargazers_count:0,archived:r.archived===true,pushedAt:clean(r.pushed_at)};
  }catch(err){skill.provenanceError=clean(err.message);return;}
  const name=skill.id.split("/").at(-1);
  const paths=["skills/"+name+"/SKILL.md",".agents/skills/"+name+"/SKILL.md",".claude/skills/"+name+"/SKILL.md","SKILL.md"];
  for(const path of paths){
    try{
      const body=await request(github+"/repos/"+skill.source+"/contents/"+path,fetcher,ms);
      if(body.encoding!=="base64"||body.size>100000||typeof body.content!=="string")continue;
      skill.audit={...auditText(Buffer.from(body.content.replace(/\s/g,""),"base64").toString("utf8")),path,revisionPinned:false};
      break;
    }catch{/* Cannot prove content at this path; try known alternatives. */}
  }
  if(!skill.audit)skill.audit={status:"UNVERIFIED",reason:"SKILL.md unavailable"};
}
export async function discover({projects,project="all",query,fetcher=fetch,verifyTop=1,timeoutMs=8000}={}){
  if(!Array.isArray(projects)||!projects.length)throw Error("MISSING_PROJECTS");
  const chosen=project==="all"?projects:projects.filter(p=>p.id===project);
  if(!chosen.length)throw Error("UNKNOWN_PROJECT");
  const summary={projects:0,queries:0,successfulQueries:0,failedQueries:0,candidates:0,verifiedRepositories:0,blocked:0};
  const report={schema:"universal-skill-intelligence/report-v1",timestamp:new Date().toISOString(),policy,provider:registry,selection:project,projects:[],summary,status:"UNVERIFIED",
    evidenceDisclaimer:"PASS proves only a valid search response, not safety, installation, business value or real-world operation."};
  for(const p of chosen){
    const terms=typeof query==="string"&&query.trim()?[query.trim()]:p.queries;
    if(!Array.isArray(terms)||!terms.length||terms.some(q=>typeof q!=="string"||q.length>100))throw Error("INVALID_QUERIES:"+p.id);
    const item={id:p.id,label:p.label,kind:p.kind,queries:[],candidates:[],status:"UNVERIFIED"},found=new Map();
    for(const q of terms){
      summary.queries++;
      try{
        const data=await request(registry+"/api/search?q="+encodeURIComponent(q)+"&limit=20",fetcher,timeoutMs);
        const skills=normalize(data).slice(0,5);
        item.queries.push({q,status:"PASS",found:skills.length});
        summary.successfulQueries++;
        for(const s of skills)found.set(s.id.toLowerCase(),s);
      }catch(err){summary.failedQueries++;item.queries.push({q,status:"FAIL",reason:clean(err.message)});}
    }
    const candidates=[...found.values()].sort((a,b)=>score(b)-score(a)||b.installs-a.installs);
    for(const s of candidates.slice(0,Math.min(3,Math.max(0,verifyTop))))await verify(s,fetcher,timeoutMs);
    item.candidates=candidates.map(s=>{
      s.score=score(s);
      s.status=s.audit?.status==="RISK_DETECTED"?"BLOCKED":s.repo?.archived?"REVIEW_REQUIRED":
        s.repo?.verified&&s.audit?.status==="CLEAN_STATIC_SCAN"&&s.score>=55?"CANDIDATE_REVIEW_REQUIRED":"UNVERIFIED";
      return s;
    });
    item.status=item.queries.some(q=>q.status==="FAIL")?"FAIL":"PASS";
    summary.projects++;
    summary.candidates+=item.candidates.length;
    summary.verifiedRepositories+=item.candidates.filter(s=>s.repo?.verified).length;
    summary.blocked+=item.candidates.filter(s=>s.status==="BLOCKED").length;
    report.projects.push(item);
  }
  report.status=summary.failedQueries?"FAIL":summary.successfulQueries?"PASS":"UNVERIFIED";
  return report;
}
export async function main(args=process.argv.slice(2)){
  const flags=Object.fromEntries(args.filter(s=>s.startsWith("--")&&s.includes("=")).map(s=>{const i=s.indexOf("=");return[s.slice(2,i),s.slice(i+1)];}));
  const config=JSON.parse(readFileSync(resolve(flags.config||"config/universal-skill-projects.json"),"utf8"));
  if(config.schema!=="universal-skill-intelligence/projects-v1")throw Error("BAD_CONFIG_SCHEMA");
  const report=await discover({projects:config.projects,project:flags.project||"all",query:flags.query,
    verifyTop:Number(flags.verifyTop??1),timeoutMs:Math.min(20000,Math.max(1000,Number(flags.timeoutMs??8000)))});
  const path=resolve(flags.report||"artifacts/universal-skills/report.json");
  mkdirSync(dirname(path),{recursive:true});writeFileSync(path,JSON.stringify(report,null,2)+"\n");
  console.log("UNIVERSAL_SKILLS "+JSON.stringify({status:report.status,summary:report.summary,report:path}));
  if(args.includes("--strict")&&report.status!=="PASS")process.exitCode=1;
  return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)
  main().catch(e=>{console.error("UNIVERSAL_SKILLS_FAIL",clean(e.message));process.exitCode=1;});
