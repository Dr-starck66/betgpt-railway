import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,writeFileSync,readFileSync,rmSync,mkdirSync,existsSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {verifyManifest,proveEntrypoint,auditContracts} from "./astra-risk-contract-proof.mjs";
const run=fn=>{const root=mkdtempSync(join(tmpdir(),"astra-contract-fixture-"));mkdirSync(join(root,"scripts"));try{return fn(root)}finally{rmSync(root,{force:true,recursive:true})}};
const entry={path:"scripts/astra-fixture.mjs",risk:"cannot-write-while-auditing"};
test("fake script without an audit block cannot be marked PASS",()=>run(root=>{
 writeFileSync(join(root,entry.path),"console.log('unsafe script')");
 const out=proveEntrypoint(root,entry);
 assert.equal(out.status,"FAIL");assert.equal(out.operationalStatus,"UNVERIFIED");
}));
test("audit guard refuses a dangerous file-writing payload before executing it",()=>run(root=>{
 const marker=join(root,"danger");
 writeFileSync(join(root,entry.path),'if(process.env.ASTRA_RISK_MODE==="audit"){console.error("ASTRA_RISK_EFFECTS_BLOCKED");process.exit(78)};\nrequire("node:fs").writeFileSync('+JSON.stringify(marker)+',"DANGER");');
 const out=proveEntrypoint(root,entry);
 assert.equal(out.status,"PASS");assert.equal(out.exitCode,78);
 assert.equal(out.workspaceClean,true);assert.equal(existsSync(marker),false);
 assert.equal(out.operationalStatus,"UNVERIFIED");
}));
test("guard that writes to disk before exiting is rejected by sandbox",()=>run(root=>{
 writeFileSync(join(root,entry.path),'import fs from "node:fs"; fs.writeFileSync("bad","oops"); if(process.env.ASTRA_RISK_MODE==="audit"){console.error("ASTRA_RISK_EFFECTS_BLOCKED");process.exit(78)};');
 const out=proveEntrypoint(root,entry);
 assert.equal(out.status,"FAIL");
}));
test("duplicate path and fake manifest entries cannot bypass the contract",()=>{
 assert.throws(()=>verifyManifest({schema:"astra-risk-scripts/v1",scripts:[entry,entry]}),/duplicate/);
 assert.throws(()=>verifyManifest({schema:"astra-risk-scripts/v1",scripts:[{path:"../escape",risk:"unsafe"}]}),/invalid/);
});
test("14 real entrypoints are audited but operationally UNVERIFIED",()=>{
 const cfg=JSON.parse(readFileSync("config/astra-risk-scripts.json","utf8"));
 assert.equal(cfg.scripts.length,14);
 const report=auditContracts(process.cwd(),cfg);
 assert.equal(report.status,"PASS");
 assert.equal(report.items.length,14);
 assert.equal(report.operationalStatus,"UNVERIFIED");
 assert.ok(report.items.every(x=>x.status==="PASS"&&x.operationalStatus==="UNVERIFIED"&&/^[a-f0-9]{64}$/.test(x.codeSha256)));
});
