import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,mkdtempSync,readdirSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {spawnSync} from "node:child_process";
const root=process.cwd();
const manifest=JSON.parse(readFileSync("config/astra-risk-scripts.json","utf8"));
const scripts=manifest.scripts.map(r=>r.path);
test("all 14 high-risk entrypoints are explicitly allowlisted",()=>{
 assert.equal(manifest.schema,"astra-risk-scripts/v1");
 assert.equal(scripts.length,14);
 assert.equal(new Set(scripts).size,14);
});
for(const script of scripts){
 test(script+" refuses its active entrypoint under isolated audit mode",()=>{
  const body=readFileSync(resolve(root,script),"utf8");
  assert.match(body.slice(0,850),/ASTRA_RISK_MODE/,"source must contain a fail-closed audit guard close to entrypoint");
  const dir=mkdtempSync(join(tmpdir(),"astra-risk-entrypoint-"));
  try{
   // No provider credentials, no attached Git repo or writable real project state.
   const run=spawnSync(process.execPath,["--experimental-strip-types",resolve(root,script),"--astra-dry-run"],{
    cwd:dir,
    env:{PATH:process.env.PATH||"/usr/bin:/bin",HOME:dir,ASTRA_RISK_MODE:"audit",CI:"1",NO_COLOR:"1"},
    encoding:"utf8",timeout:7000,maxBuffer:1024*1024
   });
   assert.equal(run.status,78,"entrypoint must exit 78 before any target script action; error: "+String(run.stderr||"").slice(0,450));
   assert.match(run.stderr,/ASTRA_RISK_EFFECTS_BLOCKED/);
   assert.match(run.stderr,/"operationStatus":"UNVERIFIED"/);
   assert.deepEqual(readdirSync(dir),[],"no artifacts or mutated files in isolated work directory");
  }finally{rmSync(dir,{force:true,recursive:true});}
 });
}
