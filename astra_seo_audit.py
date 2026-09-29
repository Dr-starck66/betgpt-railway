#!/usr/bin/env python3
import pathlib,re,json
root=pathlib.Path(__file__).resolve().parent
rows=[]
for p in root.rglob("*.html"):
 s=p.read_text("utf-8",errors="ignore")
 rows.append({"file":str(p.relative_to(root)),"h1":bool(re.search(r"<h1\b",s,re.I)),"description":bool(re.search(r"<meta[^>]+name=[\"\']description",s,re.I)),"canonical":bool(re.search(r"rel=[\"\']canonical",s,re.I)),"missing_img_alt":len(re.findall(r"<img\b(?![^>]*\balt=)[^>]*>",s,re.I)),"internal_links":len(re.findall(r"<a\b[^>]*href=[\"\'](?:/|\./|\.\./)",s,re.I))})
print(json.dumps(rows,ensure_ascii=False,indent=2))
raise SystemExit(1 if any((not x["h1"] or not x["description"] or x["missing_img_alt"]) for x in rows) else 0)
