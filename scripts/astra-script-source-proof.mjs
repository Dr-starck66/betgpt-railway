#!/usr/bin/env node
// ASTRA source evidence: syntax/integrity only. Never execute target scripts.
import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {createHash} from "node:crypto";
import {spawnSync} from "node:child_process";
import ts from "typescript";
import {pathToFileURL} from "node:url";

const sha=s=>createHash("sha256").update(s).digest("hex");
export function evaluateManifest(manifest,{cwd=process.cwd(),runner=spawnSync,read=readFileSync}={}){
 if(manifest?.schema!=="astra-script-source-proof-v1"||!Array.isArray(manifest.paths)||!manifest.paths.length)throw Error("INVALID_MANIFEST");
 const unique=new Set(),files=[];
 for(const path of manifest.paths){
  if(typeof path!=="string"||!/^scripts\/astra-[a-z0-9-]+\.(?:mjs|js|ts)$/.test(path)||unique.has(path))throw Error("UNSAFE_OR_DUPLICATE_PATH");
  unique.add(path);
  const absolute=resolve(cwd,path);
  let content;
  try{content=read(absolute,"utf8");}catch(e){files.push({path,status:"FAIL",reason:"FILE_UNREADABLE"});continue;}
  if(!content.trim()){files.push({path,status:"FAIL",reason:"EMPTY_SCRIPT"});continue;}
  const evidence={path,sha256:sha(content),sourceBytes:Buffer.byteLength(content),scope:"SOURCE_SYNTAX_ONLY"};
  if(path.endsWith(".ts")){
   const output=ts.transpileModule(content,{fileName:path,reportDiagnostics:true,
     compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}});
   const diagnostic=(output.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
   files.push({...evidence,status:diagnostic.length?"FAIL":"PASS",
    ...(diagnostic.length?{reason:"TYPESCRIPT_SYNTAX_ERROR",diagnostics:diagnostic.slice(0,3).map(d=>ts.flattenDiagnosticMessageText(d.messageText," ")).map(s=>s.slice(0,180))}:{})});
  }else{
   const p=runner(process.execPath,["--check",absolute],{encoding:"utf8",timeout:12000,maxBuffer:100000});
   files.push({...evidence,status:p.status===0&&!p.error?"PASS":"FAIL",
     ...(p.status!==0||p.error?{reason:"NODE_SYNTAX_ERROR",code:p.error?.code||p.status}:{})});
  }
 }
 const fail=files.filter(x=>x.status==="FAIL").length;
 return {schema:"astra-script-source-report-v1",generatedAt:new Date().toISOString(),scope:manifest.scope,
   summary:{checked:files.length,pass:files.length-fail,fail,behaviorTestsProved:0,productionDeploymentsProved:0},
   status:fail?"FAIL":"PASS",files};
}
export function main(){
 const manifest=JSON.parse(readFileSync("config/astra-script-source-manifest.json","utf8"));
 const result=evaluateManifest(manifest);
 const path="artifacts/astra-master-gate/script-source-report.json";
 mkdirSync(dirname(resolve(path)),{recursive:true});writeFileSync(path,JSON.stringify(result,null,2)+"\n");
 console.log("ASTRA_SCRIPT_SOURCE_PROOF "+JSON.stringify({status:result.status,summary:result.summary,report:path}));
 if(result.status!=="PASS")process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{main();}catch(e){console.error("ASTRA_SCRIPT_SOURCE_PROOF_FATAL",String(e.message));process.exitCode=1;}
}
