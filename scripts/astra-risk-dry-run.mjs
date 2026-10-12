#!/usr/bin/env node
/** Read-only dry-run for high-risk ASTRA scripts: NEVER imports or executes target code. */
import {readFileSync,existsSync,realpathSync,mkdirSync,writeFileSync} from "node:fs";
import {resolve,relative,sep,dirname} from "node:path";
import {createHash} from "node:crypto";
import {pathToFileURL} from "node:url";
const hash=b=>createHash("sha256").update(b).digest("hex");

export function inspectRiskScript(root,path,config){
 const record=config?.scripts?.find(s=>s.path===path);
 if(!record)return {path,status:"FAIL",reason:"not-in-allowlist",executionStatus:"UNVERIFIED"};
 if(!/^scripts\/astra-[a-z0-9-]+\.mjs$/.test(path))return{path,status:"FAIL",reason:"invalid-script-path",executionStatus:"UNVERIFIED"};
 const absolute=resolve(root,path);
 if(!absolute.startsWith(resolve(root)+sep))return{path,status:"FAIL",reason:"path-escape",executionStatus:"UNVERIFIED"};
 if(!existsSync(absolute))return{path,status:"FAIL",reason:"file-not-found",executionStatus:"UNVERIFIED"};
 const real=realpathSync(absolute);
 if(!real.startsWith(resolve(root)+sep))return{path,status:"FAIL",reason:"symlink-escape",executionStatus:"UNVERIFIED"};
 const bytes=readFileSync(real);
 const source=bytes.toString("utf8");
 if(!source.trim())return{path,status:"FAIL",reason:"empty-file",executionStatus:"UNVERIFIED"};
 const markers={
   network:/\bfetch\s*\(|\bhttps?\.(?:get|request|createServer)\s*\(/.test(source),
   git:/\bgit\b|\bspawnSync\b|\bexecFileSync\b/.test(source),
   fileWrite:/\b(?:writeFile|appendFile|mkdir|rename|rm|unlink)\w*\s*\(/.test(source),
   secret:/\b(?:getKey|encryptToken|decryptToken|accessToken|refresh_token|client_secret)\b/.test(source)
 };
 return {path,risk:record.risk,status:"INSPECTED_ONLY",executionStatus:"UNVERIFIED",
   bytes:bytes.length,sha256:hash(bytes),markers,
   sideEffectsPerformed:0,proofScope:"The source was read and hashed; target code was not imported or run"};
}
export function auditRiskScripts(root,config,requested=null){
 if(config?.schema!=="astra-risk-scripts/v1"||!Array.isArray(config.scripts)||!config.scripts.length)
   return {status:"FAIL",reason:"invalid-manifest",rows:[]};
 const paths=config.scripts.map(x=>x.path);
 if(new Set(paths).size!==paths.length)return {status:"FAIL",reason:"duplicate-scripts",rows:[]};
 if(requested&&!paths.includes(requested))return{status:"FAIL",reason:"script-not-registered",rows:[]};
 const rows=(requested?[requested]:paths).map(p=>inspectRiskScript(root,p,config));
 return {schema:"astra-risk-preview/report-v1",generatedAt:new Date().toISOString(),
  status:rows.every(x=>x.status==="INSPECTED_ONLY")?"INSPECTION_COMPLETE":"FAIL",
  executionStatus:"UNVERIFIED",scope:"READ_ONLY_NO_EXECUTION",rows,
  sideEffectsPerformed:0,externalCallsPerformed:0,
  warning:"Never interpret INSPECTION_COMPLETE as a successful publication, deployment, OAuth action or launch"};
}
async function main(){
 const args=process.argv.slice(2);
 if(args.some(a=>!(a==="--all"||a.startsWith("--script=")||a.startsWith("--report="))))throw Error("Unsupported flag: only static preview is available");
 const selected=args.find(x=>x.startsWith("--script="))?.slice(9)||null;
 if((selected&&!selected.startsWith("scripts/astra-"))||(!selected&&!args.includes("--all")))throw Error("Choose --all or --script=scripts/astra-....mjs");
 if(selected&&args.includes("--all"))throw Error("Use --all OR --script, not both");
 const cfg=JSON.parse(readFileSync("config/astra-risk-scripts.json","utf8"));
 const result=auditRiskScripts(process.cwd(),cfg,selected);
 const dest=args.find(x=>x.startsWith("--report="))?.slice(9);
 if(dest){
  const target=resolve(dest);
  if(!target.startsWith(resolve(process.cwd())+sep)||!relative(process.cwd(),target).startsWith("artifacts/"))throw Error("Report may only be written under artifacts/");
  mkdirSync(dirname(target),{recursive:true});writeFileSync(target,JSON.stringify(result,null,2)+"\n");
 }
 console.log("ASTRA_RISK_DRY_RUN",JSON.stringify({status:result.status,executionStatus:result.executionStatus,inspected:result.rows.length,sideEffectsPerformed:0,externalCallsPerformed:0,report:dest||null}));
 if(result.status!=="INSPECTION_COMPLETE")process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)
 main().catch(e=>{console.error("ASTRA_RISK_DRY_RUN_FAIL",e.message);process.exitCode=1});
