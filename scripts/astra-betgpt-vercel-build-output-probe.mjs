#!/usr/bin/env node
/** Preview-only Vercel independent function probe. No production publish. */
import { existsSync, mkdirSync, readFileSync, rmSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const root=process.cwd();
if (!existsSync(join(root,"config","astra-betgpt-vercel-probe.active"))) process.exit(0);
const out=join(root,".vercel","output");
const configFile=join(out,"config.json");
if(!existsSync(configFile)){ console.error("ASTRA_CONTROL_MISSING_VERSEL_OUTPUT"); process.exit(1); }
const dir=join(out,"functions","__astra_control.func");
mkdirSync(dir,{recursive:true});
writeFileSync(join(dir,".vc-config.json"),JSON.stringify({handler:"index.mjs",runtime:"nodejs22.x",launcherType:"Nodejs",shouldAddHelpers:false}));
writeFileSync(join(dir,"index.mjs"),'export default function(req,res){res.statusCode=200;res.setHeader("content-type","application/json");res.end(JSON.stringify({ok:true,control:"VERCEL_NODE_FUNCTION_READY"}));}\n');
const conf=JSON.parse(readFileSync(configFile,"utf8"));
conf.routes=[{src:"/__astra_control",dest:"/__astra_control"},...(conf.routes||[]).filter(x=>x.src!=="/__astra_control")];
writeFileSync(configFile,JSON.stringify(conf));
const fullFunctionConfig=join(out,"functions","__server.func",".vc-config.json");
const func=JSON.parse(readFileSync(fullFunctionConfig,"utf8"));
delete func.supportsResponseStreaming;
writeFileSync(fullFunctionConfig,JSON.stringify(func));
console.log("ASTRA_MAIN_FUNCTION_STREAMING_DISABLED_FOR_ISOLATED_PROOF");
const fullFunctionEntry=join(out,"functions","__server.func","index.mjs");
writeFileSync(fullFunctionEntry,'export default function(req,res){res.statusCode=200;res.setHeader("content-type","application/json");res.end(JSON.stringify({ok:true,control:"FULL_BUNDLE_TINY_HANDLER_READY"}));}\n');
console.log("ASTRA_FULL_BUNDLE_ENTRY_REPLACED_FOR_ISOLATION");
const fnDir=join(out,"functions","__server.func");
for(const file of readdirSync(fnDir)) { if (file === ".vc-config.json" || file === "index.mjs") continue; rmSync(join(fnDir,file),{recursive:true,force:true}); }
console.log("ASTRA_ISOLATED_MINIMAL_FULL_FUNCTION_READY");

console.log("ASTRA_INDEPENDENT_NODE_CONTROL_PACKAGED_POSTBUILD");
