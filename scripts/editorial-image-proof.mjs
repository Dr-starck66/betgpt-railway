#!/usr/bin/env node
/** Verify actual checked-in image bytes; never accept invented dimensions. */
import fs from "node:fs";
import path from "node:path";
import { manualEditorialArticles } from "../src/lib/editorial/manual-articles.ts";

function jpegDimensions(filename) {
  const data = fs.readFileSync(filename);
  if (data[0] !== 0xff || data[1] !== 0xd8) throw new Error("not JPEG: " + filename);
  let i = 2;
  while (i + 8 < data.length) {
    if (data[i++] !== 0xff) continue;
    let marker = data[i++];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x00 || marker === 0xff || (marker >= 0xd0 && marker <= 0xd8)) continue;
    const n = data.readUInt16BE(i); i += 2;
    if (n < 2 || i + n - 2 > data.length) throw new Error("JPEG segment invalid");
    if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker))
      return {height:data.readUInt16BE(i+1),width:data.readUInt16BE(i+3)};
    i += n - 2;
  }
  throw new Error("JPEG dimensions unavailable");
}
const today = new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const articles = manualEditorialArticles();
const required = new Set([
  "aston-villa-manchester-city-compositions-record-24-octobre-2026",
  "aston-villa-manchester-city-2-1-double-jackson-analyse-24-octobre-2026",
]);
const current = articles.filter((a)=>a.parisDate===today||required.has(a.slug));
const used = new Map();
for (const a of current) {
  const asset = a.image;
  if (!asset.src.startsWith("/blog/discover/") || asset.src.includes("..")) {
    if(required.has(a.slug)) throw new Error("match story uses unverified remote/portrait asset: "+a.slug);
    continue;
  }
  const f = path.resolve("public",asset.src.slice(1));
  if (!f.startsWith(path.resolve("public") + path.sep) || !fs.existsSync(f))
    throw new Error("missing local licensed photo "+a.slug+" "+asset.src);
  const actual = jpegDimensions(f);
  if (actual.width !== asset.width || actual.height !== asset.height ||
      actual.width < 1200 || actual.width / actual.height < 1.45 ||
      actual.width / actual.height > 2.05)
    throw new Error("false photo size/aspect "+a.slug+" meta="+JSON.stringify(asset)+" actual="+JSON.stringify(actual));
  if (!asset.credit?.includes("licence") || !asset.alt?.toLowerCase().includes("illustration"))
    if(required.has(a.slug))throw new Error("source attribution or illustration disclaimer missing: "+a.slug);
  if (used.has(asset.src)) throw new Error("duplicate publication image "+a.slug+" vs "+used.get(asset.src));
  used.set(asset.src,a.slug);
}
for (const slug of required) {
  if (!current.some(a=>a.slug===slug)) throw new Error("missing required match story "+slug);
}
console.log("ASTRA_EDITORIAL_IMAGE_PROOF_PASS",JSON.stringify({checked:current.length,localVerified:used.size,unique:used.size,dimensions:"real JPEG",rule:"1200px+, landscape, distinct"}));
