import test from "node:test";
import assert from "node:assert/strict";
import {evaluateManifest} from "./astra-script-source-proof.mjs";
const make=paths=>({schema:"astra-script-source-proof-v1",paths,scope:"syntax only"});
test("checks Node script syntax without executing its contents",()=>{
 const source="throw Error('should never execute');";
 let seen=0;
 const report=evaluateManifest(make(["scripts/astra-safe-push.mjs"]),{
  read:()=>source,runner:(_cmd,args)=>{seen++;assert.equal(args[0],"--check");return {status:0};}});
 assert.equal(seen,1);assert.equal(report.status,"PASS");
 assert.equal(report.summary.behaviorTestsProved,0);
});
test("rejects traversal, duplicates and non-ASTRA paths",()=>{
 for(const paths of [["../../secrets.json"],["scripts/other.mjs"],["scripts/astra-test.mjs","scripts/astra-test.mjs"]])
  assert.throws(()=>evaluateManifest(make(paths)),/UNSAFE_OR_DUPLICATE_PATH/);
});
test("missing or invalid file never PASSes",()=>{
 const missing=evaluateManifest(make(["scripts/astra-test.mjs"]),{read:()=>{throw Error("ENOENT")}});
 assert.equal(missing.status,"FAIL");
 const bad=evaluateManifest(make(["scripts/astra-test.mjs"]),{read:()=>"((",runner:()=>({status:1})});
 assert.equal(bad.status,"FAIL");
});
test("TypeScript syntax error is not hidden by transpilation",()=>{
 const result=evaluateManifest(make(["scripts/astra-test.ts"]),{read:()=>"export function x( {"});
 assert.equal(result.status,"FAIL");
 assert.equal(result.files[0].reason,"TYPESCRIPT_SYNTAX_ERROR");
});
test("TypeScript syntax success is not represented as typecheck or functional proof",()=>{
 const result=evaluateManifest(make(["scripts/astra-test.ts"]),{read:()=>"export const num: number = 1;"});
 assert.equal(result.status,"PASS");
 assert.equal(result.summary.behaviorTestsProved,0);
 assert.equal(result.summary.productionDeploymentsProved,0);
});
