import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {mkdtempSync,rmSync,existsSync,readdirSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
const cli=fileURLToPath(new URL("./astra-safe-push.mjs",import.meta.url));
const isolated=fn=>{
 const cwd=mkdtempSync(join(tmpdir(),"astra-safe-push-"));
 try{return fn(cwd)}finally{rmSync(cwd,{force:true,recursive:true})}
};
test("safe push preview does not execute Git or change the worktree",()=>isolated(cwd=>{
 const r=spawnSync(process.execPath,[cli,"--astra-dry-run","--branch","proof-local","artifacts/report.json"],{cwd,encoding:"utf8",timeout:10000});
 assert.equal(r.status,0,r.stderr);
 assert.match(r.stdout,/ASTRA_SAFE_PUSH_DRY_RUN/);
 assert.match(r.stdout,/"commandsExecuted":0/);
 assert.match(r.stdout,/"networkCalls":0/);
 assert.deepEqual(readdirSync(cwd),[]);
 assert.equal(existsSync(join(cwd,".git")),false);
}));
test("safe push preview fails closed on parent path escape",()=>isolated(cwd=>{
 const r=spawnSync(process.execPath,[cli,"--astra-dry-run","--branch","proof","../secrets"],{cwd,encoding:"utf8",timeout:10000});
 assert.notEqual(r.status,0);
 assert.match(r.stderr,/ASTRA_SAFE_PUSH_DRY_RUN_FAIL/);
}));
test("safe push preview fails closed on invalid branch name",()=>isolated(cwd=>{
 const r=spawnSync(process.execPath,[cli,"--astra-dry-run","--branch","../../main","artifacts/report.json"],{cwd,encoding:"utf8",timeout:10000});
 assert.notEqual(r.status,0);
}));
