#!/usr/bin/env node
/* ASTRA IMAGE INTEGRITY Ω — fail closed for duplicate, absent, undersized Lumistade images. */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const slugs = [
 "lumistade", "lumistade-avis", "lumistade-prix-livraison",
 "lumistade-stades-psg-om", "lumistade-stade-3d-cadeau-foot"
];
const variants = [
 ["lumistade-presentation","lumistade-presentation-detail"],
 ["lumistade-avis","lumistade-avis-controle"],
 ["lumistade-prix-livraison","lumistade-prix-comparatif"],
 ["lumistade-psg-om","lumistade-stades-architecture"],
 ["lumistade-cadeau","lumistade-cadeau-deco"]
];
const rich = fs.readFileSync("src/lib/blog-rich.ts","utf8");
const router = fs.readFileSync("src/routes/blog.$slug.tsx","utf8");
const blog = fs.readFileSync("src/lib/blog.ts","utf8");
const body = fs.readFileSync("src/components/blog-body.tsx","utf8");
const found = [];
function fail(msg) { console.error("ASTRA_LUMISTADE_IMAGES_FAIL:",msg); process.exit(1); }
function jpegDimensions(bytes) {
  if (bytes.length < 20 || bytes[0]!==0xff || bytes[1]!==0xd8) throw new Error("bad JPEG signature");
  let pos=2;
  while(pos+9<bytes.length) {
    if(bytes[pos]!==0xff){pos++;continue;}
    const marker=bytes[pos+1];
    if(marker===0xd9 || marker===0xda) break;
    if(marker===0xff){pos++;continue;}
    if(marker===0xd8 || marker===0x01){pos+=2;continue;}
    const len=bytes.readUInt16BE(pos+2);
    if(len<2 || pos+2+len>bytes.length)throw new Error("invalid JPEG marker");
    if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){
      return [bytes.readUInt16BE(pos+7),bytes.readUInt16BE(pos+5)];
    }
    pos+=2+len;
  }
  throw new Error("JPEG dimensions missing");
}
for(let i=0;i<slugs.length;i++){
 const slug=slugs[i];
 if(!rich.includes('"' + slug + '"') && !rich.includes(slug + ":"))fail("missing topic mapping: "+slug);
 if(!blog.includes("lumistadeCocoonArticles"))fail("article registration missing");
 for(const name of variants[i]){
  if(!rich.includes('"' + name + '"'))fail("image not bound in blog-rich: "+name);
  const file=path.join("public/blog/discover/lumistade",name+".jpg");
  if(!fs.existsSync(file))fail("missing image "+file);
  const bytes=fs.readFileSync(file);
  let dimensions;try{dimensions=jpegDimensions(bytes);}catch(err){fail(file+": "+err.message);}
  if(dimensions[0]<1200 || dimensions[1]<675)fail("Discover minimum 1200x675: "+file+" = "+dimensions.join("x"));
  found.push({name,hash:crypto.createHash("sha256").update(bytes).digest("hex")});
 }
}
if(new Set(found.map(x=>x.hash)).size!==10)fail("duplicate JPEG bytes in the Lumistade cocoon");
if(!rich.includes('if (a.cluster === "lumistade") return lumistadeVisual(a, "hero")!;'))fail("cover override missing");
if(!rich.includes('if (a.cluster === "lumistade") return lumistadeVisual(a, "detail")!;'))fail("inline override missing");
if(!router.includes('max-image-preview:large'))fail("max image preview missing");
if(!body.includes('width={img.width ?? 1200}'))fail("image intrinsic width not used");
console.log("ASTRA_LUMISTADE_IMAGE_INTEGRITY_PASS 10 distinct JPEG >=1200px, 5 covers + 5 inline, relevant topic metadata and large preview");
