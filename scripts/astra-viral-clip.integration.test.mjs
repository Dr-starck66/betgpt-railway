import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {select,render} from './lib/astra-viral-clip.mjs';
const base={site:'test-site',brand:'ASTRA',language:'fr',topic:'Test',rights:{status:'owned',reference:'Original synthetic fixture'},segments:[{start:0,end:7,topic:'Example',text:'Question ? Réponse.'}]};
function fixture(dir,name,filter){const p=path.join(dir,name);const r=spawnSync('ffmpeg',['-nostdin','-hide_banner','-loglevel','error','-y','-f','lavfi','-i',filter,'-f','lavfi','-i','sine=frequency=440:duration=7','-t','7','-c:v','libx264','-threads','2','-preset','ultrafast','-c:a','aac',p],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return p;}
test('no rights or invalid timestamps',()=>{assert.throws(()=>select({...base,rights:{}},7),/RIGHTS_REQUIRED/);assert.throws(()=>select(base,6),/INVALID_SEGMENT/);});
test('real render, multi-profile isolation, overwrite and black negative',()=>{const d=mkdtempSync(path.join(tmpdir(),'astra-clip-test-'));try{const good=fixture(d,'source.mp4','testsrc2=size=320x180:rate=30:duration=7'),bad=fixture(d,'black.mp4','color=c=black:s=320x180:r=30:d=7');const out=path.join(d,'out');const first=render(base,good,out),second=render({...base,site:'other-site',brand:'Other'},good,out);assert.equal(first.status,'PASS');assert.equal(second.status,'PASS');assert.equal(first.clips[0].proof.observed.fps,30);assert.notEqual(first.clips[0].sha256,second.clips[0].sha256);assert.throws(()=>render(base,good,out),/OUTPUT_EXISTS/);assert.throws(()=>render({...base,site:'negative'},bad,out),/SOURCE_BLACK_FAIL/);assert.equal(existsSync(path.join(out,'negative')),false);}finally{rmSync(d,{recursive:true,force:true});}});
