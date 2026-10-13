import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {mkdtempSync,rmSync,writeFileSync,existsSync,readdirSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
const cli=fileURLToPath(new URL("./astra-never-fail-build-guard.mjs",import.meta.url));
const root=fn=>{const cwd=mkdtempSync(join(tmpdir(),"astra-release-dry-"));try{return fn(cwd)}finally{rmSync(cwd,{recursive:true,force:true})}};
test("dry-run validates configured release commands but executes none",()=>root(cwd=>{
 writeFileSync(join(cwd,"config.json"),JSON.stringify({requiredChecks:[{id:"destructive",command:"touch PWNED && exit 1"}]}));
 const r=spawnSync(process.execPath,[cli,"--astra-dry-run"],{cwd,env:{...process.env,ASTRA_NEVER_FAIL_CONFIG:"config.json"},encoding:"utf8",timeout:10000});
 assert.equal(r.status,0,r.stderr);
 assert.match(r.stdout,/"commandsExecuted":0/);
 assert.equal(existsSync(join(cwd,"PWNED")),false);
 assert.deepEqual(readdirSync(cwd),["config.json"]);
}));
test("dry-run blocks an empty release check matrix",()=>root(cwd=>{
 writeFileSync(join(cwd,"config.json"),JSON.stringify({requiredChecks:[]}));
 const r=spawnSync(process.execPath,[cli,"--astra-dry-run"],{cwd,env:{...process.env,ASTRA_NEVER_FAIL_CONFIG:"config.json"},encoding:"utf8",timeout:10000});
 assert.notEqual(r.status,0);
 assert.match(r.stderr,/ASTRA_NEVER_FAIL_DRY_RUN_FAIL/);
}));
test("dry-run rejects duplicate check IDs",()=>root(cwd=>{
 writeFileSync(join(cwd,"config.json"),JSON.stringify({requiredChecks:[{id:"x",command:"true"}],extendedChecks:[{id:"x",command:"true"}]}));
 const r=spawnSync(process.execPath,[cli,"--astra-dry-run"],{cwd,env:{...process.env,ASTRA_NEVER_FAIL_CONFIG:"config.json"},encoding:"utf8",timeout:10000});
 assert.notEqual(r.status,0);
}));
