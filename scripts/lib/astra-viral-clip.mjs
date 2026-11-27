// Extension of ASTRA LAUNCH VIDEO Ω. No network, shell or paid APIs.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, statSync, realpathSync, mkdirSync, renameSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { probeVideo, detectBlack, evaluateProbe, sha256File } from './astra-launch-video.mjs';

const slug = s => /^[a-z0-9][a-z0-9-]{0,49}$/.test(s);
const plain = s => typeof s === 'string' && s.trim() && s.length <= 500 && !/[\x00-\x1f{}\\]/u.test(s);
const finite = n => typeof n === 'number' && Number.isFinite(n);
const stop = msg => { throw new Error(msg); };
const run = (args, cwd) => {
  const p = spawnSync('ffmpeg', ['-nostdin','-hide_banner','-loglevel','error',...args], {cwd, encoding:'utf8', timeout:180000});
  if (p.error || p.status !== 0) stop(`FFMPEG_FAIL ${p.error || p.stderr}`);
};
export function select(job, duration) {
  if (!slug(job.site) || !plain(job.brand) || job.brand.length > 32 || !plain(job.language) || !plain(job.topic)) stop('INVALID_PROFILE');
  if (!['owned','licensed'].includes(job.rights?.status) || !plain(job.rights?.reference)) stop('RIGHTS_REQUIRED');
  if (!Array.isArray(job.segments) || !job.segments.length || job.segments.length > 2000) stop('SEGMENTS_REQUIRED');
  let previous = 0;
  const candidates = [];
  for (const s of job.segments) {
    if (!finite(s.start) || !finite(s.end) || s.start < previous || s.end <= s.start || s.end > duration + 0.02 || !plain(s.text) || !plain(s.topic)) stop('INVALID_SEGMENT');
    previous = s.end;
    if (s.words !== undefined) {
      if (!Array.isArray(s.words) || !s.words.length || s.words.length > 1000) stop('INVALID_WORDS');
      let last = s.start;
      for (const w of s.words) {
        if (!finite(w.start) || !finite(w.end) || w.start < last || w.end <= w.start || w.end > s.end || !plain(w.text) || w.text.length > 35) stop('INVALID_WORD');
        last = w.end;
      }
    }
    if (s.end - s.start < 7 || s.end - s.start > 60) continue;
    // Transparent baseline: not a prediction of views or semantic payoff.
    const score = 2 + 2*Number(/[?]/u.test(s.text)) + 2*Number(/\d/u.test(s.text)) + Number(/[.!?]$/u.test(s.text)) + Number(s.text.split(/\s+/u).length >= 8);
    candidates.push({...s, score});
  }
  const seen = new Set();
  return candidates.sort((a,b)=>b.score-a.score || a.start-b.start).filter(s=>{const k=s.topic.trim().toLowerCase(); if(seen.has(k))return false; seen.add(k); return true;}).slice(0,5);
}
const time = t => { const n=Math.max(0,Math.round(t*100)); return `${Math.floor(n/360000)}:${String(Math.floor(n/6000)%60).padStart(2,'0')}:${String(Math.floor(n/100)%60).padStart(2,'0')}.${String(n%100).padStart(2,'0')}`; };
const line = (a,b,style,text) => `Dialogue: 0,${time(a)},${time(b)},${style},,0,0,0,,${text}`;
const wrap = text => {const rows=[]; let cur=''; for(const w of text.split(/\s+/u)){if(cur && cur.length+w.length+1>30){rows.push(cur);cur='';}cur+=(cur?' ':'')+w;}if(cur)rows.push(cur);return rows.join('\\N');};
export function captions(s, brand) {
  const length = s.end-s.start;
  const header = `[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\nWrapStyle: 0\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Cap,DejaVu Sans,60,&H00FFFFFF,&H0000FFFF,&H00101010,&H80000000,-1,0,0,0,100,100,0,0,1,5,1,2,100,100,300,1\nStyle: Brand,DejaVu Sans,48,&H00FFFFFF,&H00FFFFFF,&H00101010,&H80000000,-1,0,0,0,100,100,0,0,1,4,0,8,90,90,180,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
  const events=[line(0,length,'Brand',brand)];
  if(s.words) {
    for(let i=0;i<s.words.length;i+=3){const group=s.words.slice(i,i+3); for(let j=0;j<group.length;j++){const w=group[j]; const text=group.map((x,k)=>k===j?`{\\c&H00FFFF&}${x.text}{\\c&HFFFFFF&}`:x.text).join(' ');events.push(line(w.start-s.start,w.end-s.start,'Cap',text));}}
  } else { events.push(line(0,length,'Cap',wrap(s.text))); }
  return header+events.join('\n')+'\n';
}
export function render(job, sourceFile, outputRoot) {
  const source=realpathSync(sourceFile);
  if(!statSync(source).isFile())stop('LOCAL_FILE_REQUIRED');
  const p=probeVideo(source), duration=Number(p.format?.duration);
  if(!finite(duration)||!p.streams.some(x=>x.codec_type==='video')||!p.streams.some(x=>x.codec_type==='audio'))stop('VIDEO_AND_AUDIO_REQUIRED');
  const picks=select(job,duration); if(!picks.length)stop('NO_VALID_CLIP');
  mkdirSync(outputRoot,{recursive:true});
  const root=realpathSync(outputRoot), dest=path.join(root,job.site);
  if(existsSync(dest))stop('OUTPUT_EXISTS');
  const stage=mkdtempSync(path.join(root,'.clip-')), work=mkdtempSync(path.join(tmpdir(),'astra-clip-'));
  try {
    const results=[];
    for(let i=0;i<picks.length;i++){
      const s=picks[i], len=s.end-s.start, name=`clip-${i+1}.mp4`, out=path.join(stage,name);
      writeFileSync(path.join(work,'captions.ass'),captions(s,job.brand));
      const vf='scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0x172334,setsar=1,fps=30,ass=captions.ass';
      run(['-y','-ss',String(s.start),'-i',source,'-t',String(len),'-map','0:v:0','-map','0:a:0','-vf',vf,'-af','loudnorm=I=-14:TP=-1.5:LRA=11','-c:v','libx264','-threads','2','-preset','veryfast','-crf','22','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-ar','48000','-movflags','+faststart',out],work);
      const probe=probeVideo(out), black=detectBlack(out), fileBytes=statSync(out).size;
      const proof=evaluateProbe({probe,black,fileBytes,expected:{width:1080,height:1920,minFps:30,durationSeconds:len,durationToleranceSeconds:0.25,requireAudio:true,maxBlackSeconds:0.4,minBytes:10000}});
      if(proof.status!=='PASS'||!probe.streams.some(x=>x.codec_type==='video'&&x.codec_name==='h264')||!probe.streams.some(x=>x.codec_type==='audio'&&x.codec_name==='aac'))stop('MEDIA_PROOF_FAIL');
      run(['-xerror','-i',out,'-f','null','-'],work);
      results.push({file:name,topic:s.topic,start:s.start,end:s.end,score:s.score,captionMode:s.words?'word':'segment',sha256:sha256File(out),proof});
    }
    const report={schema:'astra-viral-clip/v1',site:job.site,brand:job.brand,language:job.language,topic:job.topic,rights:job.rights,sourceSha256:sha256File(source),status:'PASS',publication:'NOT_PUBLISHED',clips:results};
    writeFileSync(path.join(stage,'manifest.json'),JSON.stringify(report,null,2)+'\n');
    if(existsSync(dest))stop('OUTPUT_EXISTS'); renameSync(stage,dest); return report;
  } finally {rmSync(stage,{recursive:true,force:true});rmSync(work,{recursive:true,force:true});}
}
