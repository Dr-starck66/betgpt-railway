#!/usr/bin/env python3
import json,sys
from collections import Counter
def pct(n,d): return round(100*n/d,1) if d else 0.0
def analyze(d):
 r=d.get("results",[]); target=d.get("target",{}); fields=["page_type","intent","freshness_class","has_video","has_large_image","has_schema","has_faq","has_author","has_sources","brand_type"]; p={}
 for f in fields:
  v=[str(x.get(f)) for x in r if x.get(f) not in (None,"")]
  if v:
   c=Counter(v); k,n=c.most_common(1)[0]; p[f]={"dominant":k,"share_pct":pct(n,len(v)),"distribution":dict(c)}
 ec=Counter()
 for x in r: ec.update(x.get("entities",[]))
 ents=[{"entity":k,"count":n,"share_pct":pct(n,len(r))} for k,n in ec.most_common(30)]
 gaps=[]
 for f,x in p.items():
  if f in target and str(target[f])!=x["dominant"] and x["share_pct"]>=60:gaps.append({"dimension":f,"target":target[f],"serp_dominant":x["dominant"],"support_pct":x["share_pct"],"state":"INFERRED"})
 te=set(target.get("entities",[]))
 for e in ents:
  if e["share_pct"]>=40 and e["entity"] not in te:gaps.append({"dimension":"entity","missing":e["entity"],"support_pct":e["share_pct"],"state":"INFERRED"})
 return {"query":d.get("query"),"locale":d.get("locale"),"observed_at":d.get("observed_at"),"sample_size":len(r),"patterns":p,"common_entities":ents,"target_gaps":gaps,"guardrail":"SERP correlations are hypotheses, not proof of private Google ranking factors.","pipeline":["QUERY","SERP_OBSERVATION","PATTERNS","OUTLIERS","INTENT","ENTITIES","FORMAT","FRESHNESS","EVIDENCE","AUTHORITY","MEDIA","GAPS","BUILD_OR_UPDATE","VERIFY","SERP_FEEDBACK","RETEST"]}
if __name__=="__main__":
 d=json.load(open(sys.argv[1],encoding="utf-8")); o=json.dumps(analyze(d),ensure_ascii=False,indent=2); print(o) if len(sys.argv)<3 else open(sys.argv[2],"w",encoding="utf-8").write(o+"\\n")
