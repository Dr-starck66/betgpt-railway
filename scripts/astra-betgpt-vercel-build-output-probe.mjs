#!/usr/bin/env node
/** Preview-only Vercel independent function probe. No production publish. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
console.log("ASTRA_INDEPENDENT_NODE_CONTROL_PACKAGED_POSTBUILD");
