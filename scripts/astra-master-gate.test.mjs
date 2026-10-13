import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const runner=fileURLToPath(new URL("./astra-master-gate.mjs",import.meta.url));
function fixture(bricks,checks,capabilities=[]) {
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),"astra-gate-"));
  fs.mkdirSync(path.join(cwd,"config"),{recursive:true});
  const baseline=JSON.parse(fs.readFileSync(fileURLToPath(new URL("../config/astra-brick-registry.json",import.meta.url)),"utf8")).bricks;
  const ids=new Set(baseline.map(b=>b.id));
  const all=[...baseline.map(b=>({id:b.id,scope:"fixture-only",on:["seo"]})),...bricks.filter(b=>!ids.has(b.id))];
  fs.writeFileSync(path.join(cwd,"config/astra-brick-registry.json"),JSON.stringify({schema:"astra-brick-registry/1",bricks:all}));
  fs.writeFileSync(path.join(cwd,"config/astra-master-site.json"),JSON.stringify({schema:"astra-master-site/1",siteId:"test-site",capabilities,checks}));
  const run=()=> {
    const res=spawnSync(process.execPath,[runner,"--task=code","--strict"],{cwd,encoding:"utf8",timeout:10000});
    const data=JSON.parse(fs.readFileSync(path.join(cwd,"artifacts/astra-master-gate/report.json"),"utf8"));
    if (data.fatal) console.error("ASTRA_FIXTURE_FATAL", data.fatal, "STDERR", res.stderr, "STDOUT", res.stdout);
    return {res,data};
  };
  return {cwd,run};
}
const always={id:"ALWAYS",scope:"universal",on:["code"]};
const nonApplicable={id:"SEO_ONLY",scope:"seo",on:["seo"]};
test("PASS requires a successfully executed command and evidence report",()=>{
  const {run}=fixture([always,nonApplicable],{ALWAYS:[{type:"command",run:"node -e \"process.exit(0)\""}]});
  const {res,data}=run();
  assert.equal(res.status,0);
  assert.equal(data.status,"PASS");
  assert.equal(data.summary.pass,1);
  assert.equal(data.summary.na,42);
  assert.equal(data.summary.fail,0);
  assert.equal(data.summary.unverified,0);
  assert.equal(data.summary.untrackedScripts,0);
  assert.match(data.registrySha256,/^[a-f0-9]{64}$/);
});
test("missing executable proof is never a PASS",()=>{
  const {run}=fixture([always],{});
  const {res,data}=run();
  assert.notEqual(res.status,0);
  assert.equal(data.results.find(r=>r.id==="ALWAYS").status,"UNVERIFIED");
});
test("a file existing alone cannot establish activation",()=>{
  const f=fixture([always],{ALWAYS:[{type:"file",path:"config/astra-master-site.json"}]});
  const {res,data}=f.run();
  assert.notEqual(res.status,0);
  assert.equal(data.results.find(r=>r.id==="ALWAYS").status,"UNVERIFIED");
});
test("failed executable blocks strict mode",()=>{
  const {run}=fixture([always],{ALWAYS:[{type:"command",run:"node -e \"process.exit(3)\""}]});
  const {res,data}=run();
  assert.notEqual(res.status,0);
  assert.equal(data.results.find(r=>r.id==="ALWAYS").status,"FAIL");
  assert.equal(data.results.find(r=>r.id==="ALWAYS").evidence[0].exitCode,3);
});
test("unregistered binding cannot be silently accepted",()=>{
  const {run}=fixture([always],{ALWAYS:[{type:"command",run:"node -e \"process.exit(0)\""}],UNLISTED:[{type:"command",run:"true"}]});
  const {res,data}=run();
  assert.notEqual(res.status,0);
  assert.deepEqual(data.unknownBindings,["UNLISTED"]);
});

test("unregistered ASTRA scripts cannot bypass the catalog",()=>{
  const f=fixture([always],{ALWAYS:[{type:"command",run:"true"}]});
  fs.mkdirSync(path.join(f.cwd,"scripts"),{recursive:true});
  fs.writeFileSync(path.join(f.cwd,"scripts/astra-hidden-guard.mjs"),"console.log('hidden')");
  const {res,data}=f.run();
  assert.notEqual(res.status,0);
  assert.deepEqual(data.untrackedScripts,["scripts/astra-hidden-guard.mjs"]);
});

test("missing a canonical brick rejects a same-sized registry",()=>{
  const f=fixture([always],{ALWAYS:[{type:"command",run:"true"}]});
  const p=path.join(f.cwd,"config/astra-brick-registry.json");
  const registry=JSON.parse(fs.readFileSync(p,"utf8"));
  registry.bricks=registry.bricks.filter(b=>b.id!=="ASTRA_NEWS_ELIGIBILITY");
  registry.bricks.push({id:"SHADOW_BRICK",scope:"fixture-only",on:["seo"]});
  fs.writeFileSync(p,JSON.stringify(registry));
  const {res,data}=f.run();
  assert.notEqual(res.status,0);
  assert.match(data.fatal,/STALE_REGISTRY_BASELINE/);
});

test("successful command cannot falsely PASS when outcome report says UNVERIFIED",()=>{
  const runCmd='mkdir -p artifacts && printf \'{"status":"UNVERIFIED"}\' > artifacts/outcome.json';
  const f=fixture([always],{ALWAYS:[{type:"command",run:runCmd,resultReport:"artifacts/outcome.json"}]});
  const {res,data}=f.run();
  assert.notEqual(res.status,0);
  const row=data.results.find(r=>r.id==="ALWAYS");
  assert.equal(row.status,"UNVERIFIED");
  assert.equal(row.evidence[0].outcomeStatus,"UNVERIFIED");
});
test("outcome-attested command with missing report remains UNVERIFIED",()=>{
  const f=fixture([always],{ALWAYS:[{type:"command",run:"true",resultReport:"artifacts/absent.json"}]});
  const {res,data}=f.run();
  assert.notEqual(res.status,0);
  const row=data.results.find(r=>r.id==="ALWAYS");
  assert.equal(row.status,"UNVERIFIED");
  assert.match(row.evidence[0].reportReason,/missing-or-stale-outcome-report/);
});
test("outcome report with FAIL overrides successful command exit",()=>{
  const runCmd='mkdir -p artifacts && printf \'{"status":"FAIL"}\' > artifacts/outcome.json';
  const f=fixture([always],{ALWAYS:[{type:"command",run:runCmd,resultReport:"artifacts/outcome.json"}]});
  const {res,data}=f.run();
  assert.notEqual(res.status,0);
  assert.equal(data.results.find(r=>r.id==="ALWAYS").status,"FAIL");
});

test("risk contract cannot be replaced by a filename substring in a successful command",()=>{
 const script="scripts/astra-bad.mjs",f=fixture([always],{ALWAYS:[{type:"command",run:"echo scripts/astra-bad.mjs"}]});
 fs.mkdirSync(path.join(f.cwd,"scripts"),{recursive:true});
 fs.writeFileSync(path.join(f.cwd,script),"console.log('unverified active operation')");
 const cfgFile=path.join(f.cwd,"config/astra-master-site.json"),cfg=JSON.parse(fs.readFileSync(cfgFile,"utf8"));
 cfg.riskContractProof={manifest:"config/astra-risk-scripts.json",report:"artifacts/astra-risk-preflight/contracts.json"};
 fs.writeFileSync(cfgFile,JSON.stringify(cfg));
 fs.writeFileSync(path.join(f.cwd,"config/astra-risk-scripts.json"),
  JSON.stringify({schema:"astra-risk-scripts/v1",scripts:[{path:script,risk:"external-side-effects"}]}));
 const {res,data}=f.run();
 assert.notEqual(res.status,0);
 assert.equal(data.riskContract.status,"UNVERIFIED");
 assert.ok(data.untrackedScripts.includes(script));
 assert.ok(data.riskContract.reasons.includes("missing-or-stale-contract-evidence"));
});
test("forged source hash in purported risk evidence is rejected",()=>{
 const script="scripts/astra-bad.mjs",f=fixture([always],{ALWAYS:[{type:"command",run:"true"}]});
 fs.mkdirSync(path.join(f.cwd,"scripts"),{recursive:true});fs.writeFileSync(path.join(f.cwd,script),"throw Error('not safe')");
 const cfgFile=path.join(f.cwd,"config/astra-master-site.json"),cfg=JSON.parse(fs.readFileSync(cfgFile,"utf8"));
 cfg.riskContractProof={manifest:"config/astra-risk-scripts.json",report:"artifacts/astra-risk-preflight/contracts.json"};
 fs.writeFileSync(cfgFile,JSON.stringify(cfg));
 fs.writeFileSync(path.join(f.cwd,"config/astra-risk-scripts.json"),JSON.stringify({
  schema:"astra-risk-scripts/v1",scripts:[{path:script,risk:"external-side-effects"}]}));
 const reportPath=path.join(f.cwd,"artifacts/astra-risk-preflight/contracts.json");
 fs.mkdirSync(path.dirname(reportPath),{recursive:true});
 const cmd="mkdir -p artifacts/astra-risk-preflight && cp config/report-fixture.json artifacts/astra-risk-preflight/contracts.json";
 fs.writeFileSync(path.join(f.cwd,"config/report-fixture.json"),JSON.stringify({
  schema:"astra-risk-contract-proof/v1",status:"PASS",operationalStatus:"UNVERIFIED",
  items:[{path:script,risk:"external-side-effects",status:"PASS",operationalStatus:"UNVERIFIED",
   safetyContract:"DENY_OPERATION_IN_AUDIT_MODE",exitCode:78,guardRefused:true,workspaceClean:true,
   forbiddenAttempt:false,codeSha256:"0".repeat(64)}]}));
 cfg.checks.ALWAYS=[{type:"command",run:cmd}];fs.writeFileSync(cfgFile,JSON.stringify(cfg));
 const {res,data}=f.run();
 assert.notEqual(res.status,0);
 assert.ok(data.untrackedScripts.includes(script));
 assert.match(data.riskContract.reasons.join(" "),/script-contract-unproven/);
});
