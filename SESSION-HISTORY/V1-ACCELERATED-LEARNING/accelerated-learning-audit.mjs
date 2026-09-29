import fs from 'node:fs';
import { auditAcceleratedLearning } from '../src/engine/accelerated-learning.ts';

const paths = ['data/tickets.json','src/engine/seed-tickets.json'];
let rows=[];
for (const p of paths) {
  try { const x=JSON.parse(fs.readFileSync(p,'utf8')); if(Array.isArray(x)) rows.push(...x); } catch {}
}
const byId=new Map(); for(const r of rows) byId.set(r.id,r);
const audit=auditAcceleratedLearning([...byId.values()]);
fs.writeFileSync('data/accelerated-learning-audit.json',JSON.stringify({...audit,generatedAt:new Date().toISOString()},null,2));
console.log(JSON.stringify(audit,null,2));
