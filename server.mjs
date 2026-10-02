import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const articles = JSON.parse(fs.readFileSync(path.join(__dirname, "content", "articles.json"), "utf8"));
const PORT = Number(process.env.PORT || 8080);
const SITE_URL = (process.env.SITE_URL || "").replace(/\/$/, "");
const INDEXABLE = process.env.INDEXABLE === "true";
const partnerCatalog = [
  {id:"insurify", name:"Insurify", products:["auto","home","renters","business","life"], status:process.env.INSURIFY_URL?"active":"pending", url:process.env.INSURIFY_URL||"", payoutModel:"negotiated"},
  {id:"smartfinancial", name:"SmartFinancial", products:["auto","home","business"], status:process.env.SMARTFINANCIAL_URL?"active":"pending", url:process.env.SMARTFINANCIAL_URL||"", payoutModel:"qualified-lead"},
  {id:"policygenius", name:"Policygenius", products:["life","home","auto"], status:process.env.POLICYGENIUS_URL?"active":"pending", url:process.env.POLICYGENIUS_URL||"", payoutModel:"partner"},
  {id:"lendingtree", name:"LendingTree", products:["home"], status:process.env.LENDINGTREE_URL?"active":"pending", url:process.env.LENDINGTREE_URL||"", payoutModel:"partner"}
];
function partnerFor(product){
  const eligible=partnerCatalog.filter(p=>p.status==="active"&&p.products.includes(product));
  return eligible[0]||null;
}

const trustPages = {
  "/about": ["About FindInsuranceQuotes.net", "We build plain-English insurance comparison tools and editorial guides. We are not an insurer, broker, or insurance producer. When approved partner programs are connected, we may earn compensation for qualified referrals."],
  "/methodology": ["How our comparison methodology works", "We separate editorial scoring from monetization. Partner compensation never changes factual eligibility rules, coverage definitions, or our editorial explanations. Commercial placements are labeled and measured independently."],
  "/editorial-policy": ["Editorial policy", "Our articles are designed to answer one insurance question clearly, cite authoritative sources where appropriate, distinguish facts from estimates, show update dates, and disclose commercial relationships."],
  "/data-sources": ["Data sources", "We prioritize regulator, carrier, state insurance department, NAIC, government, and partner-provided quote data. We never invent premiums, discounts, approval odds, or commission amounts."],
  "/affiliate-disclosure": ["Affiliate disclosure", "FindInsuranceQuotes.net may earn a fee when a visitor clicks, requests a quote, becomes a qualified lead, or buys through an approved partner. Compensation may vary by partner. Editorial content is kept separate from partner economics."],
  "/privacy": ["Privacy", "We minimize data collection. Sensitive quote information should be sent directly to approved, licensed quote partners rather than stored on this site unless a future flow explicitly states otherwise."],
  "/terms": ["Terms", "Information on this site is educational and comparison-oriented, not legal, tax, financial, or insurance advice. Coverage and availability vary by insurer, state, country, underwriting rules, and individual circumstances."]
};

function htmlEscape(s="") {
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function baseUrl(req) {
  if (SITE_URL) return SITE_URL;
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:"+PORT;
  const proto = req.headers["x-forwarded-proto"] || (host.includes("localhost") ? "http" : "https");
  return proto + "://" + host;
}
function layout({title,description,body,canonical,noindex=false}) {
  const robots = (noindex || !INDEXABLE) ? "noindex,follow" : "index,follow,max-image-preview:large";
  const schema = {
    "@context":"https://schema.org",
    "@type":"WebSite",
    "name":"Find Insurance Quotes",
    "url":canonical.split("/").slice(0,3).join("/"),
    "description":"Insurance comparison, quote education and editorial guides."
  };
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${htmlEscape(title)}</title>
<meta name="description" content="${htmlEscape(description)}">
<meta name="robots" content="${robots}">
<link rel="canonical" href="${htmlEscape(canonical)}">
<meta property="og:type" content="website"><meta property="og:title" content="${htmlEscape(title)}">
<meta property="og:description" content="${htmlEscape(description)}"><meta property="og:url" content="${htmlEscape(canonical)}">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${JSON.stringify(schema)}</script>
<link rel="stylesheet" href="/styles.css"></head><body>${body}<script src="/app.js" defer></script></body></html>`;
}
function header() {
  return `<header class="topbar"><a class="brand" href="/"><span class="brandmark">FIQ</span><span>Find Insurance Quotes</span></a>
  <nav><a href="/#compare">Compare</a><a href="/#guides">Guides</a><a href="/methodology">Methodology</a><a href="/affiliate-disclosure">Disclosure</a></nav></header>`;
}
function footer() {
  return `<footer><div><strong>FindInsuranceQuotes.net</strong><p>Independent comparison guidance. Not an insurer or insurance producer.</p></div>
  <div class="footerlinks"><a href="/about">About</a><a href="/editorial-policy">Editorial policy</a><a href="/data-sources">Data sources</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></div></footer>`;
}
function home(req) {
  const base=baseUrl(req);
  const cards=articles.slice(0,6).map(a=>`<article class="card"><span class="eyebrow">${htmlEscape(a.category)}</span><h3><a href="/guides/${a.slug}">${htmlEscape(a.title)}</a></h3><p>${htmlEscape(a.description)}</p><small>Updated ${htmlEscape(a.updated)}</small></article>`).join("");
  const body=`${header()}<main>
<section class="hero"><div class="heroCopy"><span class="pill">Insurance clarity, without the sales fog</span><h1>Compare smarter. Understand coverage. Pay less when possible.</h1><p>Start with your insurance goal. We explain what matters, then route qualified shoppers to approved quote partners when available.</p>
<div class="heroActions"><a class="primary" href="#compare">Compare options</a><button class="secondary" data-open-chat>Ask the quote assistant</button></div>
<div class="trustrow"><span>✓ Editorial / commercial separation</span><span>✓ No invented premiums</span><span>✓ Partner links disclosed</span></div></div>
<div class="scorecard"><div><b>6</b><span>core insurance verticals</span></div><div><b>0</b><span>fake quote numbers</span></div><div><b>100%</b><span>partner disclosure</span></div></div></section>

<section id="compare" class="compare"><div><span class="eyebrow">Quote finder</span><h2>What do you want to insure?</h2><p>Choose a category. Until approved partner integrations are active, we show the information path instead of fabricating a quote.</p></div>
<div class="quoteGrid">
<button data-product="auto">🚗 Auto</button><button data-product="home">🏠 Home</button><button data-product="life">❤️ Life</button>
<button data-product="renters">🔑 Renters</button><button data-product="business">🏢 Business</button><button data-product="health">🩺 Health</button>
</div><div id="quoteResult" class="quoteResult" hidden></div></section>

<section id="guides"><div class="sectionHead"><div><span class="eyebrow">Editorial engine</span><h2>Insurance guides built for real decisions</h2></div><a href="/guides">All guides →</a></div><div class="cards">${cards}</div></section>

<section class="money"><div><span class="eyebrow">How we make money</span><h2>Revenue without hiding the incentive</h2></div><p>When approved programs are connected, we may earn a referral, lead, or sale fee. Partner economics are tracked separately from editorial ranking. <a href="/affiliate-disclosure">Read the disclosure.</a></p></section>
</main>

<div class="chat" id="chat" aria-hidden="true"><div class="chatHead"><div><b>FIQ Quote Assistant</b><small>Educational guidance, not insurance advice</small></div><button data-close-chat>×</button></div>
<div class="chatBody" id="chatBody"><div class="bot">Tell me what you want to insure and your main priority: lowest price, stronger coverage, or understanding a policy.</div></div>
<form id="chatForm"><input id="chatInput" placeholder="e.g. I need cheaper car insurance" autocomplete="off"><button>Send</button></form></div>
${footer()}`;
  return layout({title:"Find Insurance Quotes | Compare Insurance Smarter",description:"Compare insurance options, learn how coverage works, and connect with approved quote partners without fake premiums or hidden incentives.",body,canonical:base+"/"});
}
function guideIndex(req){
 const base=baseUrl(req);
 const cards=articles.map(a=>`<article class="card"><span class="eyebrow">${htmlEscape(a.category)}</span><h2><a href="/guides/${a.slug}">${htmlEscape(a.title)}</a></h2><p>${htmlEscape(a.description)}</p><small>Updated ${a.updated}</small></article>`).join("");
 return layout({title:"Insurance Guides | Find Insurance Quotes",description:"Practical insurance guides covering auto, home, life, renters, business and health insurance.",canonical:base+"/guides",body:header()+`<main class="content"><h1>Insurance guides</h1><p class="lede">Useful first, commercial second. Every guide has one clear job.</p><div class="cards">${cards}</div></main>`+footer()});
}
function guidePage(req,a){
 const base=baseUrl(req); const canonical=base+"/guides/"+a.slug;
 const schema={"@context":"https://schema.org","@type":"Article","headline":a.title,"dateModified":a.updated,"mainEntityOfPage":canonical};
 const sections=a.sections.map(s=>`<section><h2>${htmlEscape(s.heading)}</h2><p>${htmlEscape(s.text)}</p></section>`).join("");
 const body=header()+`<main class="article"><a class="back" href="/guides">← All guides</a><span class="eyebrow">${a.category}</span><h1>${htmlEscape(a.title)}</h1><p class="lede">${htmlEscape(a.description)}</p><div class="meta">Updated ${a.updated} · Editorial review required before material changes</div>${sections}
 <aside class="cta"><h2>Ready to compare?</h2><p>Approved quote partners will appear here only after the commercial relationship and tracking are verified.</p><a class="primary" href="/#compare">Start with your insurance type</a></aside>
 <script type="application/ld+json">${JSON.stringify(schema)}</script></main>`+footer();
 return layout({title:a.title+" | Find Insurance Quotes",description:a.description,canonical,body});
}
function trustPage(req,p){
 const [title,text]=trustPages[p]; const base=baseUrl(req);
 return layout({title:title+" | Find Insurance Quotes",description:text.slice(0,155),canonical:base+p,body:header()+`<main class="content narrow"><h1>${title}</h1><p class="lede">${text}</p></main>`+footer()});
}
function send(res,status,type,body){res.writeHead(status,{"content-type":type,"cache-control":type.includes("text/html")?"public, max-age=60":"no-store"});res.end(body);}
function staticFile(res,pathname){
 const file=path.join(publicDir,pathname.replace(/^\//,""));
 if(!file.startsWith(publicDir)||!fs.existsSync(file)||fs.statSync(file).isDirectory()) return false;
 const ext=path.extname(file); const types={".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",".svg":"image/svg+xml"};
 send(res,200,types[ext]||"application/octet-stream",fs.readFileSync(file)); return true;
}
function assistant(message){
 const m=message.toLowerCase();
 if(/car|auto|vehicle|driver/.test(m)) return "For auto insurance, compare liability limits, collision/comprehensive deductibles, uninsured-motorist protection, discounts, and the same coverage limits across every quote. A cheap quote with lower limits is not a fair comparison.";
 if(/home|house|property/.test(m)) return "For homeowners insurance, focus on dwelling replacement cost, liability, deductible structure, exclusions, and whether flood or earthquake coverage is separate. Compare equivalent coverage before comparing price.";
 if(/life|death|term/.test(m)) return "For life insurance, start with the coverage amount, term length, underwriting type, and financial-strength considerations. Term life is often the cleanest product to compare for a defined protection period.";
 if(/health|medical/.test(m)) return "For health coverage, premium alone is not enough: compare deductible, out-of-pocket maximum, network, prescriptions, subsidies or eligibility rules, and country/state-specific enrollment rules.";
 if(/business|commercial/.test(m)) return "Business insurance depends heavily on activity and location. Common starting points are general liability, property, professional liability, workers' compensation, cyber, and commercial auto.";
 return "I can help you compare the structure of auto, home, life, renters, business, or health insurance. Tell me the product and what matters most to you. I won't invent a premium or claim that one policy is best without real quote data.";
}
async function readJson(req){let b="";for await(const c of req){b+=c;if(b.length>20000)break;}try{return JSON.parse(b||"{}")}catch{return {}}}
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,"http://localhost");
 const p=url.pathname;
 if(req.method==="GET"&&p==="/api/health") return send(res,200,"application/json",JSON.stringify({ok:true,service:"findinsurancequotes",indexable:INDEXABLE,activePartners:partnerCatalog.filter(x=>x.status==="active").length}));
 if(req.method==="GET"&&p==="/api/partner"){const product=(url.searchParams.get("product")||"").toLowerCase();const partner=partnerFor(product);return send(res,200,"application/json",JSON.stringify(partner?{active:true,partner:{id:partner.id,name:partner.name,url:partner.url,payoutModel:partner.payoutModel}}:{active:false,reason:"No verified partner is active for this product yet."}));}
 if(req.method==="POST"&&p==="/api/chat"){const j=await readJson(req);return send(res,200,"application/json",JSON.stringify({reply:assistant(String(j.message||""))}));}
 if(req.method==="GET"&&p==="/robots.txt"){const base=baseUrl(req);return send(res,200,"text/plain; charset=utf-8",INDEXABLE?`User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\nSitemap: ${base}/news-sitemap.xml\n`:"User-agent: *\nDisallow: /\n");}
 if(req.method==="GET"&&p==="/sitemap.xml"){const base=baseUrl(req);const urls=["/","/guides",...Object.keys(trustPages),...articles.map(a=>"/guides/"+a.slug)];return send(res,200,"application/xml; charset=utf-8",`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(x=>`<url><loc>${base+x}</loc></url>`).join("")}</urlset>`);}
 if(req.method==="GET"&&p==="/news-sitemap.xml"){const base=baseUrl(req);const fresh=articles.filter(a=>Date.now()-Date.parse(a.updated)<48*3600*1000);return send(res,200,"application/xml; charset=utf-8",`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${fresh.map(a=>`<url><loc>${base}/guides/${a.slug}</loc></url>`).join("")}</urlset>`);}
 if(req.method==="GET"&&p==="/") return send(res,200,"text/html; charset=utf-8",home(req));
 if(req.method==="GET"&&p==="/guides") return send(res,200,"text/html; charset=utf-8",guideIndex(req));
 if(req.method==="GET"&&trustPages[p]) return send(res,200,"text/html; charset=utf-8",trustPage(req,p));
 if(req.method==="GET"&&p.startsWith("/guides/")){const slug=p.slice(8);const a=articles.find(x=>x.slug===slug);if(a)return send(res,200,"text/html; charset=utf-8",guidePage(req,a));}
 if(req.method==="GET"&&staticFile(res,p)) return;
 send(res,404,"text/html; charset=utf-8",layout({title:"Not found | Find Insurance Quotes",description:"Page not found.",canonical:baseUrl(req)+p,noindex:true,body:header()+'<main class="content narrow"><h1>Page not found</h1><p><a href="/">Return home</a></p></main>'+footer()}));
});
server.listen(PORT,"0.0.0.0",()=>console.log(`findinsurancequotes listening on ${PORT}`));
