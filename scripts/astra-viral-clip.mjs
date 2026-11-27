import {readFileSync} from 'node:fs';
import {render} from './lib/astra-viral-clip.mjs';
const [job,source,out]=process.argv.slice(2);
if(!job||!source||!out)throw new Error('Usage: node scripts/astra-viral-clip.mjs job.json source.mp4 output-dir');
console.log(JSON.stringify(render(JSON.parse(readFileSync(job,'utf8')),source,out),null,2));
