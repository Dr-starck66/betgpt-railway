// ASTRA CONSIGNES Ω — dependency-free build preflight, no network or paid API.
import {readFileSync} from 'node:fs';
const fail=(message)=>{console.error('ASTRA_CONSIGNES_FAIL '+message);process.exit(1)};
const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
if(!pkg.scripts?.prebuild?.includes('astra-consignes-preflight.mjs')) fail('PREFLIGHT_NOT_WIRED');
const expected=['zero-cost','batch-tasks','three-pubs','proof-first','do-not-repeat','wine-else-occitanie'];
const source=readFileSync(new URL('../AGENTS.project.md',import.meta.url),'utf8');
for(const word of ['ZÉRO COÛT','TÂCHE','3 publications','FAUX PASS','Occitanie']) if(!source.includes(word)) fail('MISSING_RULE '+word);
console.log(JSON.stringify({status:'PASS',scope:'LOCAL_BUILD_PREFLIGHT_ONLY',rules:expected,production:'UNVERIFIED'}));
