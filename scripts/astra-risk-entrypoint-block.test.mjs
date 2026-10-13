import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,mkdtempSync,rmSync,readdirSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
// This preloader forbids network, child process and filesystem mutations even during ESM import.
// Target scripts must exit 78 before their operational logic executes.
const denySource=`import http from 'node:http';
import https from 'node:https';
 import net from 'node:net';
 import fs from 'node:fs';
 import cp from 'node:child_process';
 import {syncBuiltinESMExports} from 'node:module';
 const deny=()=>{throw Error('ASTRA_FORBIDDEN_EFFECT_ATTEMPT');};
 globalThis.fetch=deny;
 for (const k of ['get','request']) {http[k]=deny;https[k]=deny;}
 for (const k of ['connect','createConnection']) net[k]=deny;
 for (const k of ['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork']) cp[k]=deny;
 for (const k of ['writeFileSync','appendFileSync','mkdirSync','createWriteStream','renameSync','rmSync','unlinkSync']) fs[k]=deny;
 syncBuiltinESMExports();`;
const sentinel="data:text/javascript,"+encodeURIComponent(denySource);
const manifest=JSON.parse(readFileSync("config/astra-risk-scripts.json","utf8"));
test("all 14 listed scripts must opt into an active-operation audit kill switch",()=>{
 assert.equal(manifest.scripts.length,14);
 assert.equal(new Set(manifest.scripts.map(s=>s.path)).size,14);
 for(const item of manifest.scripts){
  const source=readFileSync(item.path,"utf8");
  assert.match(source,/ASTRA_RISK_EFFECTS_BLOCKED/,item.path);
  assert.match(source,/process\.env\.ASTRA_RISK_MODE === "audit"/,item.path);
 }
});
for (const item of manifest.scripts) {
 test("real risk entrypoint blocks before effects: "+item.path,()=>{
  const cwd=mkdtempSync(join(tmpdir(),"astra-risk-locked-"));
  try{
   const run=spawnSync(process.execPath,["--experimental-strip-types","--import",sentinel,resolve(item.path)],
     {cwd,encoding:"utf8",timeout:15000,maxBuffer:1024*1024,
      env:{PATH:process.env.PATH||"",HOME:cwd,ASTRA_RISK_MODE:"audit",CI:"true"}});
   assert.equal(run.status,78,JSON.stringify({script:item.path,code:run.status,error:run.error?.message,stderr:run.stderr?.slice(-1200)}));
   assert.match(run.stderr,/ASTRA_RISK_EFFECTS_BLOCKED/,item.path);
   assert.doesNotMatch((run.stdout||"")+(run.stderr||""),/ASTRA_FORBIDDEN_EFFECT_ATTEMPT/,item.path);
   assert.deepEqual(readdirSync(cwd),[],item.path+" mutated audit workspace");
  }finally{rmSync(cwd,{recursive:true,force:true})}
 });
}
