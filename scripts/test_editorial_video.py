import copy, importlib.util, json, tempfile, unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('editorial',Path(__file__).with_name('astra-editorial-video.py'))
m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
ROOT=Path(__file__).resolve().parents[1]
a=json.loads((ROOT/'demo/articles/gaming.json').read_text())
class Test(unittest.TestCase):
 def test_valid(self): self.assertEqual(len(m.prepare(a)),2)
 def test_rights(self):
  b=copy.deepcopy(a); b['rights']={}
  with self.assertRaisesRegex(ValueError,'RIGHTS_REQUIRED'): m.prepare(b)
 def test_traversal(self):
  b=copy.deepcopy(a); b['id']='../outside'
  with self.assertRaisesRegex(ValueError,'ARTICLE_ID_REQUIRED'): m.prepare(b)
 def test_duplicate(self):
  b=copy.deepcopy(a); b['paragraphs']=[a['paragraphs'][0]]*3
  with self.assertRaisesRegex(ValueError,'INSUFFICIENT_EXTRACTS'): m.prepare(b)
 def test_language(self):
  b=copy.deepcopy(a); b['language']='en'
  with self.assertRaisesRegex(ValueError,'PROFILE_REQUIRED'): m.prepare(b)
 def test_replay(self): self.assertEqual(m.build(a,ROOT/'demo/output')['status'],'SKIP_VERIFIED')
 def test_conflict(self):
  b=copy.deepcopy(a); b['title']='Autre titre'
  with self.assertRaisesRegex(ValueError,'ARTICLE_ID_CONFLICT'): m.build(b,ROOT/'demo/output')
 def test_corruption(self):
  import shutil
  with tempfile.TemporaryDirectory() as d:
   root=Path(d); dest=root/'gamicnews--demo-gaming'; shutil.copytree(ROOT/'demo/output'/dest.name,dest)
   (dest/'gamicnews/clip-1.mp4').write_bytes(b'bad')
   with self.assertRaisesRegex(ValueError,'INTEGRITY_FAIL'): m.build(a,root)
if __name__=='__main__': unittest.main(verbosity=2)
