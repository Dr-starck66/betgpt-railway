import assert from "node:assert/strict";
import {manualEditorialArticles} from "../src/lib/editorial/manual-articles.ts";
import {editorialGoldStandardGate,GOLD_STANDARD_REFERENCE_SLUG} from "../src/lib/editorial/gold-standard.ts";
import {qualityGate} from "../src/lib/editorial/quality.ts";

const baseline=manualEditorialArticles().find(x=>x.slug===GOLD_STANDARD_REFERENCE_SLUG);
assert.ok(baseline,"canonical factual football reference was not found");
const good=editorialGoldStandardGate(baseline);
assert.equal(good.pass,true,JSON.stringify(good.reasons));
const variants=[
  " La reconstruction SEO avec une densité de mots-clés augmente la visibilité sur Google.",
  " Comment nous vérifions les projets : les prochaines mises à jour seront diffusées.",
  " Quelles informations changent et lesquelles doivent rester constantes dans la région."
];
for(const bad of variants){
  const doctored=structuredClone(baseline);
  doctored.lead+=bad;
  const gold=editorialGoldStandardGate(doctored);
  assert.equal(gold.pass,false,"FALSE PASS Gold Standard "+bad);
  assert.ok(gold.reasons.some(x=>/jargon de générateur/.test(x)),JSON.stringify(gold.reasons));
  const quality=qualityGate(doctored,[]);
  assert.ok(quality.reasons.some(x=>/remplissage éditorial générique/.test(x)),"FALSE PASS qualityGate "+bad+" reasons: "+quality.reasons.join("|"));
}
console.log("ASTRA_BETGPT_EDITORIAL_BOILERPLATE_NEGATIVE_PASS",JSON.stringify({negativeExamples:variants.length,goldReferenceWords:good.words,baselinePass:good.pass}));
