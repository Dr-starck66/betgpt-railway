import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const script=fileURLToPath(new URL("./astra-release-gate.mjs",import.meta.url));
function runPipeline(command) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"astra-editorial-gate-"));
  const config=path.join(dir,"config.json");
  const evidence=path.join(dir,"evidence");
  fs.writeFileSync(config,JSON.stringify({siteId:"betgpt.live",
    canonicalOrigin:"https://example.test",publicOrigins:["https://example.test"],
    healthPath:"/health",revisionPath:"/revision",
    pipelines:{editorial:{commands:[command]}}}));
  try {
    const result=spawnSync(process.execPath,[script,"pipeline","editorial"],{
      cwd:dir,env:{...process.env,ASTRA_RELEASE_GATE_CONFIG:config,
      ASTRA_RELEASE_GATE_EVIDENCE_DIR:evidence},encoding:"utf8",timeout:10000});
    const record=JSON.parse(fs.readFileSync(path.join(evidence,"pipeline-editorial.json"),"utf8"));
    return {result,record};
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
}
test("blocked editorial publication exits 78, reports BLOCKED_CONTENT and never passes",()=>{
  const {result,record}=runPipeline("node -e 'process.exit(78)'");
  assert.equal(result.status,78);
  assert.equal(record.status,"BLOCKED_CONTENT");
  assert.equal(record.pass,false);
  assert.equal(record.blockedContent,true);
});
test("other editorial rejection exits nonzero",()=>{
  const {result,record}=runPipeline("node -e 'process.exit(1)'");
  assert.equal(result.status,1);
  assert.equal(record.status,"FAIL");
  assert.equal(record.pass,false);
});
test("successful completed pipeline alone is PASS",()=>{
  const {result,record}=runPipeline("node -e 'process.exit(0)'");
  assert.equal(result.status,0);
  assert.equal(record.status,"PASS");
  assert.equal(record.pass,true);
});
