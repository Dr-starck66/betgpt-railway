#!/usr/bin/env node
/**
 * ASTRA BETGPT — read-only, reproducible historical Pinnacle benchmark.
 * Source: football-data.co.uk, English Premier League CSV 2024/25 or 2025/26.
 * No secret, no betting action, no prediction training, no live price claims.
 * Source's post-23-Jul-2025 Pinnacle quotes are explicitly unreliable.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
const SOURCES = Object.freeze({
  "2425": "https://www.football-data.co.uk/mmz4281/2425/E0.csv",
  "2526": "https://www.football-data.co.uk/mmz4281/2526/E0.csv",
});
const CUTOFF = "2025-07-23";
const OUTCOMES = ["H", "D", "A"];
const FINITE_ODDS = (x) => Number.isFinite(x) && x >= 1.05 && x <= 100;
const round = (n) => n === null ? null : Number(n.toFixed(6));
const mean = (nums) => nums.length ? nums.reduce((a,b) => a + b, 0) / nums.length : null;

export function parseCsv(text) {
  if (typeof text !== "string") throw Error("CSV_NOT_TEXT");
  const lines = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i+1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {row.push(field);field="";}
    else if (c === "\n") {row.push(field.replace(/\r$/, ""));lines.push(row);row=[];field="";}
    else field += c;
  }
  if (quoted) throw Error("UNCLOSED_CSV_QUOTE");
  if (row.length || field) { row.push(field.replace(/\r$/, ""));lines.push(row); }
  const headers = (lines.shift() ?? []).map((v,i) => i===0 ? v.replace(/^\uFEFF/,"") : v);
  if (!headers.includes("HomeTeam") || !headers.includes("AwayTeam") || !headers.includes("FTR") || !headers.includes("Date")) throw Error("INVALID_FOOTBALL_DATA_SCHEMA");
  if (new Set(headers).size !== headers.length) throw Error("DUPLICATE_CSV_COLUMN");
  return lines.filter(x => x.some(v=>v.trim())).map(fields => {
    if (fields.length !== headers.length) throw Error("CSV_FIELD_COUNT_MISMATCH");
    return Object.fromEntries(headers.map((name,i)=>[name,fields[i]]));
  });
}

function parsedDate(raw) {
  const m=String(raw??"").match(/^(\d\d)\/(\d\d)\/(\d\d|\d{4})$/);
  if(!m)return null;
  const y=m[3].length===2 ? 2000+Number(m[3]) : Number(m[3]);
  const mo=Number(m[2]),d=Number(m[1]);
  const dt=new Date(Date.UTC(y,mo-1,d));
  return dt.getUTCFullYear()===y && dt.getUTCMonth()===mo-1 && dt.getUTCDate()===d ? dt.toISOString().slice(0,10) : null;
}
function odds3(row, prefix) {
  const vals=(prefix==="PS" ? ["PSCH","PSCD","PSCA"] : ["B365CH","B365CD","B365CA"]).map(k => {
    const raw=row[k];
    return typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;
  });
  if (!vals.every(FINITE_ODDS)) return null;
  const inverse=vals.map(o=>1/o),sum=inverse.reduce((a,b)=>a+b,0);
  if (!Number.isFinite(sum) || sum<0.95 || sum>1.30) return null;
  return {odds:vals,prob:inverse.map(v=>v/sum),overround:sum-1};
}
function score(q, result) {
  const y=OUTCOMES.indexOf(result);
  if (y<0) return null;
  return {
    brier:q.prob.reduce((a,p,i)=>a+(p-(i===y?1:0))**2,0),
    logLoss:-Math.log(q.prob[y]),
  };
}
/** Evaluate actual historical 1X2 and closing odds, without pretending to know precise quote timestamps. */
export function auditHistoricalCsv(content, season="2425") {
  if(!SOURCES[season])throw Error("UNSUPPORTED_SEASON");
  const rows=parseCsv(content);
  const earliest = season==="2425"?"2024-07-01":"2025-07-01";
  const latest = season==="2425"?"2025-07-31":"2026-07-31";
  let finished=0, pinnComplete=0, paired=0, invalidRows=0;
  let suspiciousAfterClosure=0;
  const seen=new Set(), results=[],pairP=[],pairB=[],margins=[], dates=[];
  for (const row of rows) {
    const date=parsedDate(row.Date);
    if(!date || date<earliest || date>latest || !row.HomeTeam?.trim() || !row.AwayTeam?.trim() || row.HomeTeam===row.AwayTeam || !OUTCOMES.includes(row.FTR)) {
      invalidRows++; continue;
    }
    const id=[date,row.HomeTeam.toLowerCase(),row.AwayTeam.toLowerCase()].join("|");
    if(seen.has(id)){invalidRows++;continue;}
    seen.add(id);finished++;
    const p=odds3(row,"PS"), b=odds3(row,"B365");
    if(!p) continue;
    pinnComplete++; dates.push(date);
    if(date>=CUTOFF)suspiciousAfterClosure++;
    const ps=score(p,row.FTR);
    results.push(ps);
    margins.push(p.overround);
    if(b){
      paired++;pairP.push(ps);pairB.push(score(b,row.FTR));
    }
  }
  return {
    schema:"astra-betgpt-pinnacle-historical/v1",
    source:SOURCES[season], season, league:"Premier League",
    csvSha256:createHash("sha256").update(content,"utf8").digest("hex"),
    rowsTotal:rows.length, validFixtures:finished, invalidOrDuplicateRows:invalidRows,
    pinnacleClosing1x2Rows:pinnComplete, pairedBet365ClosingRows:paired,
    coverage:finished?round(pinnComplete/finished):null,
    earliestPinnacleDate:dates.sort()[0]??null, latestPinnacleDate:dates.at(-1)??null,
    postApiClosureRows:suspiciousAfterClosure,
    pinnacleMedianMargin: margins.length?round([...margins].sort((a,b)=>a-b)[Math.floor(margins.length/2)]):null,
    pinnacleBrier:round(mean(results.map(x=>x.brier))),
    pinnacleLogLoss:round(mean(results.map(x=>x.logLoss))),
    pairedPinnacleBrier:round(mean(pairP.map(x=>x.brier))),
    pairedBet365Brier:round(mean(pairB.map(x=>x.brier))),
    pairedPinnacleLogLoss:round(mean(pairP.map(x=>x.logLoss))),
    pairedBet365LogLoss:round(mean(pairB.map(x=>x.logLoss))),
    reliability:season==="2425" && suspiciousAfterClosure===0 ? "HISTORICAL_PRE_CLOSURE_ARCHIVE" : "POST_2025_07_23_PINNACLE_STALE_WARNING",
    modelOutOfSampleVerified:false,
    valueBetsProven:false,
    executableLiveSignals:false,
    notes:[
      "Historical bookmaker probabilities are derived from closing decimal quotes with proportional vig removal.",
      "Brier is sum of squared probability errors across 1X2 (lower is better).",
      "Market closing odds are retrospective and must never be used as pre-match tradable signals.",
      "Rows have match date but not precise Pinnacle quote timestamp; no intraday freshness or CLV proven.",
      "Football-Data warns its Pinnacle prices since 23 July 2025 are systematically outdated.",
    ],
  };
}
async function main(args) {
  const season=args.includes("--season")?args[args.indexOf("--season")+1]:"2425";
  if(!SOURCES[season])throw Error("UNSUPPORTED_SEASON");
  const local = args.includes("--csv")?args[args.indexOf("--csv")+1]:null;
  const content=local?await readFile(local,"utf8"):(await (async()=>{
    const r=await fetch(SOURCES[season],{signal:AbortSignal.timeout(12000),headers:{"user-agent":"ASTRA-BetGPT-Research/1.0"}});
    if(!r.ok)throw Error("SOURCE_HTTP_"+r.status);
    const text=await r.text();
    if(text.length<1000 || text.length>5_000_000)throw Error("SOURCE_SIZE_INVALID");
    return text;
  })());
  console.log(JSON.stringify(auditHistoricalCsv(content,season),null,2));
}
if(process.argv[1] && pathToFileURL(process.argv[1]).href===import.meta.url) {
  main(process.argv.slice(2)).catch(e=>{console.error("ASTRA_HISTORICAL_AUDIT_FAIL",e.message);process.exitCode=1});
}
