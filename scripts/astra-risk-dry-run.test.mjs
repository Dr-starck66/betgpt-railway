import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,mkdirSync,writeFileSync,existsSync,rmSync,readFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,dirname} from "node:path";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {inspectRiskScript,auditRiskScripts} from "./astra-risk-dry-run.mjs";
const path="scripts/astra-danger.mjs";
const cfg={schema:"astra-risk-scripts/v1",scripts:[{path,risk:"do-not-execute"}]};
const fixture=fn=>{
 const root=mkdtempSync(join(tmpdir(),"astra-risk-preview-"));
 try{mkdirSync(join(root,"scripts"),{recursive:true});return fn(root)}
 finally{rmSync(root,{recursive:true,force:true})}
};
test("dry-run scans real bytes without evaluating destructive imports or writes",()=>fixture(root=>{
 const sentinel=join(root,"SIDE_EFFECT");
 const script='import {writeFileSync} from "node:fs"; writeFileSync('+JSON.stringify(sentinel)+',"BAD"); throw Error("should never execute");';
 writeFileSync(join(root,path),script);
 const r=inspectRiskScript(root,path,cfg);
 assert.equal(r.status,"INSPECTED_ONLY");
 assert.equal(r.executionStatus,"UNVERIFIED");
 assert.equal(r.sideEffectsPerformed,0);
 assert.equal(r.markers.fileWrite,true);
 assert.equal(existsSync(sentinel),false);
}));
test("unknown script is blocked rather than silently allowed",()=>fixture(root=>{
 assert.equal(inspectRiskScript(root,"scripts/astra-not-listed.mjs",cfg).status,"FAIL");
}));
test("missing source is a failed inspection, not a PASS",()=>fixture(root=>{
 const report=auditRiskScripts(root,cfg);
 assert.equal(report.status,"FAIL");
 assert.equal(report.executionStatus,"UNVERIFIED");
}));
test("duplicate allowlist entries fail closed",()=>fixture(root=>{
 const report=auditRiskScripts(root,{...cfg,scripts:[...cfg.scripts,...cfg.scripts]});
 assert.equal(report.status,"FAIL");
}));
test("all real 14 risk-script targets are statically inspectable without execution",()=>{
 const root=process.cwd();
 const manifest=JSON.parse(readFileSync(join(root,"config/astra-risk-scripts.json"),"utf8"));
 assert.equal(manifest.scripts.length,14);
 const r=auditRiskScripts(root,manifest);
 assert.equal(r.rows.length,14);
 assert.equal(r.status,"INSPECTION_COMPLETE");
 assert.equal(r.executionStatus,"UNVERIFIED");
 assert.equal(r.sideEffectsPerformed,0);
 assert.equal(r.externalCallsPerformed,0);
 assert.ok(r.rows.every(x=>/^[a-f0-9]{64}$/.test(x.sha256)));
});
test("unsupported execution flags cannot invoke the target script",()=>{
 const executable=fileURLToPath(new URL("./astra-risk-dry-run.mjs",import.meta.url));
 const result=spawnSync(process.execPath,[executable,"--execute"],{encoding:"utf8",timeout:10000});
 assert.notEqual(result.status,0);
 assert.match(result.stderr,/Unsupported flag/);
});
test("a valid static preview is inspection only, never execution PASS",()=>fixture(root=>{
 writeFileSync(join(root,path),"console.log('real code is never invoked')");
 const r=auditRiskScripts(root,cfg);
 assert.equal(r.status,"INSPECTION_COMPLETE");
 assert.equal(r.executionStatus,"UNVERIFIED");
 assert.notEqual(r.status,"PASS");
}));
