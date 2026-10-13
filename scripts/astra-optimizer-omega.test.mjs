import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {assess,evaluateExperiment,validateConfig} from './astra-optimizer-omega.mjs';
const registry={schema:'astra-brick-registry/1',bricks:[{id:'ONE',scope:'universal'},{id:'TWO',scope:'seo'}]};
const config={schema:'astra-optimizer/config-v1',brickGoals:{ONE:'availability',TWO:'availability'},
 goals:{availability:{metric:'healthy_rate',direction:'min',target:.95,minSamples:100,maxAgeHours:48,rate:true}}};
const master={siteId:'controller',capabilities:['seo'],checks:{ONE:[{type:'command',run:'node -v'}]}};
const portfolio={sites:[{baseUrl:'https://example.org',capabilities:['seo']}]};
const now=Date.parse('2026-10-12T18:00:00Z');
const withTemp=fn=>{const dir=mkdtempSync(join(tmpdir(),'astra-'));try{return fn(dir)}finally{rmSync(dir,{recursive:true,force:true})}};
function proof(dir,value,name='proof.json'){
 const data=JSON.stringify({status:'PASS',metric:value});writeFileSync(join(dir,name),data);
 return {id:name,siteId:'https://example.org',brickId:'ONE',metric:'healthy_rate',value,samples:2000,
  verified:true,observedAt:'2026-10-12T17:00:00Z',evidenceFile:name,pointer:'/metric',proofPointer:'/status',
  fileSha256:createHash('sha256').update(data).digest('hex')};
}
test('unknown future brick requires objective',()=>assert.deepEqual(
 validateConfig({...registry,bricks:[...registry.bricks,{id:'THREE'}]},config).unmapped,['THREE']));
test('unknown capabilities and absent measurements fail closed',()=>{
 const result=assess(registry,config,master,{sites:[{baseUrl:'https://example.org'}]},[],process.cwd(),now);
 assert.equal(result.status,'UNVERIFIED');assert.equal(result.totals.UNVERIFIED,2);
});
test('real artifact can PASS but unmeasured bricks remain UNVERIFIED',()=>withTemp(dir=>{
 const report=assess(registry,config,master,portfolio,[proof(dir,.99)],dir,now);
 assert.equal(report.sites[0].results[0].status,'PASS');
 assert.equal(report.sites[0].results[1].status,'UNVERIFIED');
}));
test('tampering hash / missing source proof / stale metric never PASS',()=>withTemp(dir=>{
 const p=proof(dir,.99);
 for(const change of [{fileSha256:'bad'},{proofPointer:'/other'},{observedAt:'2020-01-01T00:00:00Z'},{samples:2}]){
  const r=assess(registry,config,master,portfolio,[{...p,...change}],dir,now);
  assert.equal(r.sites[0].results[0].status,'UNVERIFIED');
 }
}));
test('objective degradation produces FAIL despite PASS-labelled artifact',()=>withTemp(dir=>{
 const r=assess(registry,config,master,portfolio,[proof(dir,.90)],dir,now);
 assert.equal(r.sites[0].results[0].status,'FAIL');assert.equal(r.status,'FAIL');
}));
test('cost violation cannot promote candidate',()=>withTemp(dir=>{
 const a=proof(dir,.80,'control.json'),b=proof(dir,.99,'candidate.json');
 const e={id:'trial',goal:'availability',control:'control.json',candidate:'candidate.json',extraSpendEur:0};
 assert.equal(evaluateExperiment(e,[a,b],config,dir,now).action,'PROPOSE_PROMOTION');
 assert.equal(evaluateExperiment({...e,extraSpendEur:1},[a,b],config,dir,now).status,'FAIL');
 assert.equal(evaluateExperiment({...e,guardrails:[{goal:'availability',candidate:'missing'}]},[a,b],config,dir,now).action,'ROLLBACK');
}));
test('missing central executable checks are reported',()=>{
 const r=assess(registry,config,master,portfolio,[],process.cwd(),now);
 assert.deepEqual(r.controller.missingExecutableChecks,['TWO']);
});
test('staging excludes irrelevant indexation tests but keeps universal proofs',()=>{
 const r=assess(registry,config,master,{sites:[{baseUrl:'https://stage.example.org',mode:'exclude',capabilities:['seo']}]},[],process.cwd(),now);
 assert.equal(r.sites[0].results[1].status,'N/A');
 assert.equal(r.sites[0].results[0].status,'UNVERIFIED');
});
