#!/usr/bin/env node
/** ASTRA OPTIMIZER Ω. Node 22, no paid APIs, fail-closed evidence and objective engine. */
import {readFileSync,writeFileSync,existsSync,mkdirSync,realpathSync} from 'node:fs';
import {dirname,resolve,relative,isAbsolute,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const SHA=data=>createHash('sha256').update(data).digest('hex');
const PASS='PASS',FAIL='FAIL',UNVERIFIED='UNVERIFIED';
function safeFile(root,p){
  if(!p||typeof p!=='string'||isAbsolute(p))throw Error('Expected repository-relative path');
  const path=resolve(root,p);
  if(path!==root&&!path.startsWith(root+sep))throw Error('Path escapes repository: '+p);
  if(existsSync(path)){const actual=realpathSync(path);if(actual!==root&&!actual.startsWith(root+sep))throw Error('Symlink escapes repository: '+p);}
  return path;
}
const readJson=(root,file)=>JSON.parse(readFileSync(safeFile(root,file),'utf8'));
const readOptional=(root,file,fallback)=>existsSync(safeFile(root,file))?readJson(root,file):fallback;
function pointer(obj,p){
  if(typeof p!=='string'||!p.startsWith('/')||p.length<2)throw Error('Invalid JSON pointer');
  return p.slice(1).split('/').reduce((o,t)=>o?.[t.replace(/~1/g,'/').replace(/~0/g,'~')],obj);
}
function wilson(value,n){
  if(!Number.isFinite(value)||value<0||value>1||!Number.isSafeInteger(n)||n<1)return null;
  const z=1.96,d=1+z*z/n,c=(value+z*z/(2*n))/d,m=z*Math.sqrt(value*(1-value)/n+z*z/(4*n*n))/d;
  return {lo:Math.max(0,c-m),hi:Math.min(1,c+m)};
}
export function objectiveFor(cfg,id){const key=cfg.brickGoals?.[id];return key?cfg.goals?.[key]??null:null;}
export function validateConfig(registry,cfg){
  if(registry?.schema!=='astra-brick-registry/1'||!Array.isArray(registry.bricks))throw Error('Bad registry');
  if(cfg?.schema!=='astra-optimizer/config-v1'||!cfg.goals||!cfg.brickGoals)throw Error('Bad optimizer config');
  const ids=registry.bricks.map(b=>b.id);
  if(ids.some(id=>!id)||new Set(ids).size!==ids.length)throw Error('Duplicate brick IDs');
  for(const [key,g] of Object.entries(cfg.goals)){
    if(typeof g.metric!=='string'||!['min','max'].includes(g.direction)||!Number.isFinite(g.target)||
       !Number.isSafeInteger(g.minSamples)||g.minSamples<1||!(g.maxAgeHours>0))throw Error('Bad goal: '+key);
    if(g.rate&&(g.target<0||g.target>1))throw Error('Bad rate goal: '+key);
  }
  return {unmapped:ids.filter(id=>!objectiveFor(cfg,id)),stale:Object.keys(cfg.brickGoals).filter(id=>!ids.includes(id))};
}
function observationProof(root,o,g,now){
  try{
    if(!o||o.metric!==g.metric||o.verified!==true)throw Error('metric-not-verified');
    if(!Number.isSafeInteger(o.samples)||o.samples<g.minSamples)throw Error('insufficient-samples');
    const when=Date.parse(o.observedAt);
    if(!Number.isFinite(when)||when>now+300000||when<now-g.maxAgeHours*3600000)throw Error('stale-or-invalid');
    const data=readFileSync(safeFile(root,o.evidenceFile)),doc=JSON.parse(data.toString('utf8'));
    if(!o.pointer||o.fileSha256!==SHA(data))throw Error('artifact-hash-mismatch');
    const value=pointer(doc,o.pointer);
    if(typeof value!=='number'||!Number.isFinite(value)||value!==o.value)throw Error('value-not-in-artifact');
    if(g.rate&&(value<0||value>1))throw Error('invalid-rate');
    if(!o.proofPointer||pointer(doc,o.proofPointer)!==PASS)throw Error('source-proof-not-pass');
    return {status:PASS,value,samples:o.samples,artifactSha256:o.fileSha256};
  }catch(e){return {status:UNVERIFIED,reason:e.message};}
}
function score(g,m){
  if(m.status!==PASS)return m;
  const bounds=g.rate?wilson(m.value,m.samples):null;
  const conservative=g.rate?(g.direction==='min'?bounds.lo:bounds.hi):m.value;
  return {...m,status:(g.direction==='min'?conservative>=g.target:conservative<=g.target)?PASS:FAIL,
    goal:g.target,direction:g.direction,conservativeValue:conservative,bounds};
}
export function assess(registry,cfg,master,portfolio,observations=[],root=process.cwd(),now=Date.now()){
  const coverage=validateConfig(registry,cfg);
  if(!Array.isArray(portfolio.sites))throw Error('Missing portfolio sites');
  const sites=[],unique=new Set();
  for(const site of portfolio.sites){
    const siteId=site.baseUrl;
    if(typeof siteId!=='string'||!/^https:\/\//.test(siteId)||unique.has(siteId))throw Error('Bad or duplicate URL');
    unique.add(siteId);
    const caps=site.capabilities,configured=Array.isArray(caps)&&caps.length>0&&caps.every(x=>typeof x==='string');
    const results=[];
    for(const brick of registry.bricks){
      const goal=objectiveFor(cfg,brick.id);
      if(!goal){results.push({brickId:brick.id,status:UNVERIFIED,reason:'objective-not-mapped'});continue;}
      if(!configured){results.push({brickId:brick.id,status:UNVERIFIED,reason:'site-capabilities-not-declared'});continue;}
      if(site.mode==='exclude'&&['seo','news'].includes(brick.scope)){
        results.push({brickId:brick.id,status:'N/A',reason:'excluded-staging-site'});continue;
      }
      if(brick.scope!=='universal'&&!caps.includes(brick.scope)){
        results.push({brickId:brick.id,status:UNVERIFIED,reason:'scope-not-proven-live'});continue;
      }
      const found=observations.filter(o=>o.siteId===siteId&&o.brickId===brick.id&&o.metric===goal.metric)
        .sort((a,b)=>String(b.observedAt).localeCompare(String(a.observedAt)))[0];
      results.push({brickId:brick.id,metric:goal.metric,...score(goal,observationProof(root,found,goal,now))});
    }
    const summary={PASS:0,FAIL:0,UNVERIFIED:0,'N/A':0};
    for(const r of results)summary[r.status]++;
    sites.push({siteId,displayName:site.name||siteId,mode:site.mode||'index',summary,
      status:summary.FAIL?FAIL:summary.UNVERIFIED?UNVERIFIED:PASS,results});
  }
  const applicable=registry.bricks.filter(b=>b.scope==='universal'||(master.capabilities||[]).includes(b.scope));
  const missingExecutableChecks=applicable.filter(b=>!(master.checks?.[b.id]||[]).some(c=>['command','http'].includes(c.type))).map(b=>b.id);
  const controller={siteId:master.siteId,registered:registry.bricks.length,
    mapped:registry.bricks.length-coverage.unmapped.length,applicable:applicable.length,
    missingExecutableChecks,unmapped:coverage.unmapped,staleObjectives:coverage.stale,
    unknownCheckBindings:Object.keys(master.checks||{}).filter(id=>!registry.bricks.some(b=>b.id===id))};
  const totals={PASS:0,FAIL:0,UNVERIFIED:0,'N/A':0};
  for(const site of sites)for(const k of Object.keys(totals))totals[k]+=site.summary[k];
  const priorities=sites.flatMap(s=>s.results.filter(r=>r.status===FAIL||r.status===UNVERIFIED)
    .map(r=>({site:s.siteId,brickId:r.brickId,status:r.status,reason:r.reason||'objective-not-achieved',
      nextAction:r.reason==='site-capabilities-not-declared'?'declare-verified-site-capabilities':
        r.reason==='objective-not-mapped'?'define-objective':'collect-provider-metric-and-retest'})));
  const status=controller.unmapped.length||controller.staleObjectives.length||
    controller.unknownCheckBindings.length||totals.FAIL?FAIL:
    controller.missingExecutableChecks.length||totals.UNVERIFIED?UNVERIFIED:PASS;
  return {schema:'astra-optimizer/audit-v1',generatedAt:new Date(now).toISOString(),
    status,controller,totals,sites,priorities};
}
export function evaluateExperiment(e,obs,cfg,root=process.cwd(),now=Date.now()){
  if(!e?.id||!cfg.goals?.[e.goal]||!e.control||!e.candidate)
    return {id:e?.id??null,status:UNVERIFIED,reason:'experiment-not-configured'};
  if(e.extraSpendEur!==0)return {id:e.id,status:FAIL,reason:'zero-cost-policy-violated'};
  const g=cfg.goals[e.goal],a=observationProof(root,obs.find(o=>o.id===e.control),g,now),
    b=observationProof(root,obs.find(o=>o.id===e.candidate),g,now);
  if(a.status!==PASS||b.status!==PASS)
    return {id:e.id,status:UNVERIFIED,reason:'missing-control-or-candidate-proof'};
  const delta=(b.value-a.value)*(g.direction==='min'?1:-1);
  const ba=g.rate?wilson(a.value,a.samples):null,bb=g.rate?wilson(b.value,b.samples):null;
  const significant=g.rate?(g.direction==='min'?bb.lo>ba.hi:bb.hi<ba.lo):
    delta>=(e.minimumDelta??0.01);
  const blocked=(e.guardrails||[]).some(rule=>{
    const guard=cfg.goals[rule.goal];
    if(!guard)return true;
    return score(guard,observationProof(root,obs.find(o=>o.id===rule.candidate),guard,now)).status!==PASS;
  });
  return {id:e.id,status:blocked?FAIL:delta>0&&significant?PASS:UNVERIFIED,delta,
    action:blocked?'ROLLBACK':delta>0&&significant?'PROPOSE_PROMOTION':'KEEP_CONTROL',
    reason:blocked?'guardrail-failed':significant&&delta>0?'candidate-awaits-review':'insufficient-benefit-or-confidence'};
}
async function main(){
  const root=process.cwd(),args=process.argv.slice(2),
    arg=(key,defaultValue)=>args.find(x=>x.startsWith('--'+key+'='))?.slice(key.length+3)??defaultValue;
  const cfg=readJson(root,arg('config','config/astra-optimizer-omega.json'));
  const registry=readJson(root,arg('registry','config/astra-brick-registry.json'));
  const master=readJson(root,arg('master-config','config/astra-master-site.json'));
  const portfolio=readJson(root,arg('portfolio','config/portfolio-sites.json'));
  const observations=readOptional(root,arg('observations','reports/astra-optimizer/observations.json'),{observations:[]});
  if(!Array.isArray(observations.observations))throw Error('Observations must be an array');
  // No manual claim or domain-name inference counts as live capability verification.
  // Only same-run HTTP evidence with a substantive public homepage can pass.
  const audit=readOptional(root,arg('capability-audit','artifacts/astra-capabilities/live.json'),null);
  const age=audit?Date.now()-Date.parse(audit.generatedAt):Infinity;
  const auditValid=audit?.schema==='astra-site-capabilities/live-v1'&&Array.isArray(audit?.sites)&&
    age>=-300000&&age<=5400000&&audit.sites.length===portfolio.sites.length&&
    new Set(audit.sites.map(s=>s.siteId)).size===portfolio.sites.length;
  const audited=portfolio.sites.map(site=>{
    const entry=auditValid?audit.sites.find(s=>s.siteId===site.baseUrl):null;
    const proof=entry?.status==='PASS'&&entry.evidence?.httpStatus===200&&
      typeof entry.evidence?.bodySha256==='string'&&/^[a-f0-9]{64}$/.test(entry.evidence.bodySha256)&&
      Array.isArray(entry.verifiedCapabilities)&&entry.verifiedCapabilities.includes('runtime');
    return {...site,capabilities:proof?entry.verifiedCapabilities:[]};
  });
  const report=assess(registry,cfg,master,{...portfolio,sites:audited},observations.observations,root);
  report.capabilityCoverage={total:portfolio.sites.length,verified:audited.filter(s=>s.capabilities.length>0).length,
    unverified:audited.filter(s=>s.capabilities.length===0).length,
    failed:auditValid?audit.sites.filter(s=>s.status==='FAIL').length:0,
    evidenceFresh:!!auditValid,
    sites:portfolio.sites.map(s=>{
      const e=auditValid?audit.sites.find(a=>a.siteId===s.baseUrl):null;
      return {siteId:s.baseUrl,status:e?.status||'UNVERIFIED',httpStatus:e?.evidence?.httpStatus||null,
        capabilities:e?.status==='PASS'?e.verifiedCapabilities:[],
        reasons:e?.reasons||['missing-live-audit']};
    })};
  if(!auditValid)report.status=UNVERIFIED;
  const experiments=readOptional(root,arg('experiments','config/astra-optimizer-experiments.json'),{experiments:[]});
  report.experiments=(experiments.experiments||[]).map(e=>evaluateExperiment(e,observations.observations,cfg,root));
  const path=safeFile(root,arg('output','artifacts/astra-optimizer/report.json'));
  mkdirSync(dirname(path),{recursive:true});writeFileSync(path,JSON.stringify(report,null,2)+'\n');
  console.log('ASTRA_OPTIMIZER',JSON.stringify({status:report.status,controller:report.controller,
    totals:report.totals,capabilityCoverage:report.capabilityCoverage,experiments:report.experiments,report:relative(root,path)}));
  if(args.includes('--strict')&&report.status!==PASS)process.exitCode=1;
  if(args.includes('--strict-controller')&&(report.controller.unmapped.length||
    report.controller.staleObjectives.length||report.controller.missingExecutableChecks.length||
    report.controller.unknownCheckBindings.length))process.exitCode=1;
  if(args.includes('--fail-on-regression')&&(report.status===FAIL||
    report.experiments.some(e=>e.status===FAIL)))process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)
  main().catch(e=>{console.error('ASTRA_OPTIMIZER_FATAL',e.stack||e);process.exitCode=1});
