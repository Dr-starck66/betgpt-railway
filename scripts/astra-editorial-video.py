"""Article-to-social adapter for ASTRA VIRAL CLIP; local execution only."""
import argparse, hashlib, json, re, subprocess, tempfile, textwrap, wave
from pathlib import Path
HERE=Path(__file__).resolve().parent
PROFILES={'gamicnews':('GamicNews','0x142C48'),'freehotels':('FreeHotels.info','0x17463F'),'wine-else':('WINE ELSE','0x512A3E'),'astra-science':('ASTRA Science','0x21345C')}
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def run(*args,cwd=None): return subprocess.run(args,cwd=cwd,check=True,capture_output=True,text=True,timeout=240).stdout
def clean(s): return isinstance(s,str) and bool(s.strip()) and not re.search(r'[\x00-\x1f{}\\]',s)
def prepare(a):
    if a.get('site') not in PROFILES or a.get('language')!='fr': raise ValueError('PROFILE_REQUIRED')
    if a.get('rights',{}).get('status') not in ('owned','licensed') or not clean(a.get('rights',{}).get('reference')): raise ValueError('RIGHTS_REQUIRED')
    if not clean(a.get('title')) or len(a['title'])>75: raise ValueError('TITLE_REQUIRED')
    if not re.fullmatch(r'[a-z0-9][a-z0-9-]{0,79}',a.get('id','')): raise ValueError('ARTICLE_ID_REQUIRED')
    paras=a.get('paragraphs'); seen=set(); picks=[]
    if not isinstance(paras,list) or not 1<=len(paras)<=200 or not all(clean(p) and len(p)<=5000 for p in paras): raise ValueError('PARAGRAPHS_REQUIRED')
    for i,p in enumerate(paras):
        for s in re.split(r'(?<=[.!?])\s+',p.strip()):
            k=' '.join(s.casefold().split())
            if 65<=len(s)<=120 and s[-1] in '.!?' and k not in seen and all(len(w)<=25 for w in s.split()):
                seen.add(k); picks.append((i+1,s)); break
    if len(picks)<2: raise ValueError('INSUFFICIENT_EXTRACTS')
    return picks[:5]
def build(a,root):
    picks=prepare(a); brand,color=PROFILES[a['site']]
    digest=hashlib.sha256(json.dumps(a,sort_keys=True,ensure_ascii=False).encode()).hexdigest()
    root=Path(root).resolve(); root.mkdir(parents=True,exist_ok=True)
    final=root/(a['site']+'--'+a['id']); lock=final.with_suffix('.lock')
    if final.exists():
        m=json.loads((final/'editorial.json').read_text())
        if m['articleSha256']!=digest: raise ValueError('ARTICLE_ID_CONFLICT')
        if len(m['clips'])!=len(picks) or not all(sha(final/a['site']/c['file'])==c['sha256'] for c in m['clips']): raise ValueError('INTEGRITY_FAIL')
        return {'status':'SKIP_VERIFIED','path':str(final),'clips':len(m['clips'])}
    lock.mkdir()
    try:
        with tempfile.TemporaryDirectory(prefix='.editorial-',dir=root) as tmp:
            work=Path(tmp); stage=work/'result'; stage.mkdir(); segs=[]; files=[]; pos=0
            for j,(idx,sentence) in enumerate(picks):
                (work/'speech.txt').write_text(sentence,encoding='utf-8')
                run('espeak','-v','fr','-s','155','-f','speech.txt','-w','speech.wav',cwd=work)
                with wave.open(str(work/'speech.wav')) as wav: seconds=wav.getnframes()/wav.getframerate()
                if seconds>59: raise ValueError('SPEECH_TOO_LONG')
                duration=max(7,int(seconds+1.9)); name=f'part{j}.mp4'
                (work/'title.txt').write_text('\n'.join(textwrap.wrap(a['title'],width=24)),encoding='utf-8')
                (work/'part.txt').write_text(f'POINT {j+1} / {len(picks)}',encoding='utf-8')
                font='font=DejaVu Sans'
                vf=(f'drawbox=x=80:y=240:w=560:h=650:color=white@0.12:t=fill,drawbox=x=80:y=240:w=560:h=8:color=0xE9BA72:t=fill,'
                    f'drawtext={font}:textfile=part.txt:expansion=none:fontsize=29:fontcolor=0xE9BA72:x=(w-tw)/2:y=300,'
                    f'drawtext={font}:textfile=title.txt:expansion=none:fontsize=43:fontcolor=white:x=(w-tw)/2:y=430:line_spacing=18')
                run('ffmpeg','-nostdin','-v','error','-y','-f','lavfi','-i',f'color=c={color}:s=720x1280:r=30','-i','speech.wav','-vf',vf,'-af','apad','-t',str(duration),'-c:v','libx264','-threads','2','-preset','ultrafast','-pix_fmt','yuv420p','-c:a','aac','-ar','48000',name,cwd=work)
                files.append(name); segs.append({'start':pos,'end':pos+duration,'topic':f'Paragraphe {idx}','text':sentence}); pos+=duration
            (work/'concat.txt').write_text(''.join(f"file '{n}'\n" for n in files))
            run('ffmpeg','-nostdin','-v','error','-y','-f','concat','-safe','1','-i','concat.txt','-c','copy','source.mp4',cwd=work)
            job={'site':a['site'],'brand':brand,'language':'fr','topic':a['title'],'rights':a['rights'],'segments':segs}
            (work/'job.json').write_text(json.dumps(job,ensure_ascii=False),encoding='utf-8')
            report=json.loads(run('node',str(HERE/'astra-viral-clip.mjs'),str(work/'job.json'),str(work/'source.mp4'),str(stage)))
            if report['status']!='PASS' or len(report['clips'])!=len(picks): raise ValueError('RENDER_INCOMPLETE')
            for c in report['clips']:
                c['sourceText']=next(s['text'] for s in segs if s['topic']==c['topic'])
                if sha(stage/a['site']/c['file'])!=c['sha256']: raise ValueError('INTEGRITY_FAIL')
            manifest={'status':'PASS','articleSha256':digest,'articleId':a['id'],'title':a['title'],'site':a['site'],'voice':'espeak/fr','captionMode':'segment','publication':'NOT_PUBLISHED','clips':report['clips']}
            (stage/'editorial.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
            (stage/'article.json').write_text(json.dumps(a,ensure_ascii=False,indent=2))
            if final.exists(): raise ValueError('OUTPUT_EXISTS')
            stage.rename(final)
            return {'status':'PASS','path':str(final),'clips':len(picks)}
    finally: lock.rmdir()
if __name__=='__main__':
    p=argparse.ArgumentParser(); p.add_argument('input',type=Path); p.add_argument('output',type=Path); args=p.parse_args()
    files=sorted(args.input.glob('*.json')) if args.input.is_dir() else [args.input]
    if not files: p.error('No articles')
    failed=False
    for f in files:
        try: print(json.dumps(build(json.loads(f.read_text()),args.output),ensure_ascii=False),flush=True)
        except Exception as e: failed=True; print(json.dumps({'status':'FAIL','article':f.name,'error':str(e)},ensure_ascii=False),flush=True)
    raise SystemExit(int(failed))
