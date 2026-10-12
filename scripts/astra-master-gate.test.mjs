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
  assert.equal(data.results[0].status,"UNVERIFIED");
});
test("a file existing alone cannot establish activation",()=>{
  const f=fixture([always],{ALWAYS:[{type:"file",path:"config/astra-master-site.json"}]});
  const {res,data}=f.run();
  assert.notEqual(res.status,0);
  assert.equal(data.results[0].status,"UNVERIFIED");
});
test("failed executable blocks strict mode",()=>{
  const {run}=fixture([always],{ALWAYS:[{type:"command",run:"node -e \"process.exit(3)\""}]});
  const {res,data}=run();
  assert.notEqual(res.status,0);
  assert.equal(data.results[0].status,"FAIL");
  assert.equal(data.results[0].evidence[0].exitCode,3);
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
