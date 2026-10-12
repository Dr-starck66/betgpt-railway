#!/usr/bin/env node
/** ASTRA risk contract: real isolated process runs, no active operation is allowed. */
import {spawnSync} from "node:child_process";
import {readFileSync,writeFileSync,existsSync,mkdtempSync,readdirSync,rmSync,mkdirSync,realpathSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,resolve,relative,dirname,sep} from "node:path";
import {createHash} from "node:crypto";
import {pathToFileURL} from "node:url";
const sha256=x=>createHash("sha256").update(x).digest("hex");
const ROOT=process.cwd();
export const MANIFEST="config/astra-risk-scripts.json";
export const REPORT="artifacts/astra-risk-preflight/contracts.json";
export const PRELOAD=String.raw`import fs from 'node:fs';
import http from 'node:http';import https from 'node:https';import net from 'node:net';
import cp from 'node:child_process';import {syncBuiltinESMExports} from 'node:module';
const deny=()=>{throw Error('ASTRA_FORBIDDEN_OPERATION');};
globalThis.fetch=deny;
for(const key of ['get','request','createServer']){http[key]=deny;https[key]=deny;}
for(const key of ['connect','createConnection','createServer'])net[key]=deny;
for(const key of ['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork'])cp[key]=deny;
for(const key of ['writeFileSync','appendFileSync','mkdirSync','createWriteStream','renameSync','rmSync','unlinkSync','openSync'])fs[key]=deny;
syncBuiltinESMExports();`;
function safePath(root,path){
 if(typeof path!=="string"||!/^scripts\/astra-[a-z0-9-]+\.mjs$/.test(path))throw Error("invalid-script-path");
 const abs=resolve(root,path);
 if(!abs.startsWith(resolve(root)+sep)||!existsSync(abs))throw Error("missing-or-escaped-script");
 if(realpathSync(abs)!==abs)throw Error("symlink-not-allowed");
 return abs;
}
export function verifyManifest(manifest){
 if(manifest?.schema!=="astra-risk-scripts/v1"||!Array.isArray(manifest.scripts)||!manifest.scripts.length)throw Error("risk-manifest-invalid");
 const paths=manifest.scripts.map(x=>x.path);
 if(new Set(paths).size!==paths.length)throw Error("risk-manifest-duplicate");
 for(const item of manifest.scripts)if(typeof item.risk!=="string"||item.risk.length<5||
     !/^scripts\/astra-[a-z0-9-]+\.mjs$/.test(item.path))throw Error("risk-manifest-entry-invalid");
 return paths;
}
export function proveEntrypoint(root,record){
 const file=safePath(root,record.path);
 const bytes=readFileSync(file);
 const cwd=mkdtempSync(join(tmpdir(),"astra-risk-contract-"));
 try{
  const run=spawnSync(process.execPath,["--experimental-strip-types","--import",
    "data:text/javascript,"+encodeURIComponent(PRELOAD),file],{
   cwd,encoding:"utf8",timeout:12000,maxBuffer:1024*1024,
   env:{PATH:process.env.PATH||"/usr/bin:/bin",HOME:cwd,CI:"true",ASTRA_RISK_MODE:"audit"}
  });
  const refused=run.status===78&&/ASTRA_RISK_EFFECTS_BLOCKED/.test(run.stderr||"");
  const forbidden=/ASTRA_FORBIDDEN_OPERATION/.test((run.stderr||"")+(run.stdout||""));
  const noWrites=readdirSync(cwd).length===0;
  return {path:record.path,risk:record.risk,codeSha256:sha256(bytes),
   status:refused&&!forbidden&&noWrites?"PASS":"FAIL",
   safetyContract:"DENY_OPERATION_IN_AUDIT_MODE",
   operationalStatus:"UNVERIFIED",exitCode:run.status,
   guardRefused:refused,forbiddenAttempt:forbidden,workspaceClean:noWrites,
   processError:run.error?.code||null};
 }finally{rmSync(cwd,{force:true,recursive:true});}
}
export function auditContracts(root,manifest){
 const paths=verifyManifest(manifest);
 const items=manifest.scripts.map(x=>proveEntrypoint(root,x));
 return {schema:"astra-risk-contract-proof/v1",generatedAt:new Date().toISOString(),
   status:items.length===paths.length&&items.every(x=>x.status==="PASS")?"PASS":"FAIL",
   scope:"AUDIT_MODE_OPERATION_REFUSAL_ONLY",operationalStatus:"UNVERIFIED",
   sampleCount:items.length,items,
   note:"PASS proves an isolated audit kill-switch, not any real social post, archive, deployment, sync, OAuth operation or render"};
}
async function main(){
 const args=process.argv.slice(2);
 if(args.some(x=>x!=="--all"&&!x.startsWith("--report=")))throw Error("Unsupported flags");
 if(!args.includes("--all"))throw Error("--all required");
 const manifest=JSON.parse(readFileSync(resolve(ROOT,MANIFEST),"utf8"));
 const report=auditContracts(ROOT,manifest);
 const path=resolve(ROOT,args.find(a=>a.startsWith("--report="))?.slice(9)||REPORT);
 if(!path.startsWith(ROOT+sep)||!relative(ROOT,path).startsWith("artifacts/"))throw Error("report must live under artifacts/");
 mkdirSync(dirname(path),{recursive:true});
 writeFileSync(path,JSON.stringify(report,null,2)+"\n");
 console.log("ASTRA_RISK_CONTRACT",JSON.stringify({status:report.status,
   checked:report.items.length,safetyPass:report.items.filter(x=>x.status==="PASS").length,
   operationalStatus:report.operationalStatus,report:relative(ROOT,path)}));
 if(report.status!=="PASS")process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)
 main().catch(e=>{console.error("ASTRA_RISK_CONTRACT_FATAL",e.message);process.exitCode=1});
