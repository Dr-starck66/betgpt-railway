import test from "node:test";
import assert from "node:assert/strict";
import { auditHistoricalCsv,parseCsv } from "./audit-pinnacle-historical.mjs";
const header="Div,Date,HomeTeam,AwayTeam,FTR,PSCH,PSCD,PSCA,B365CH,B365CD,B365CA";
const line=(d,h,a,r,odds=["2.1","3.4","3.6","2.2","3.2","3.5"]) =>
  ["E0",d,h,a,r,...odds].join(",");
const csv=(...rows)=>[header,...rows].join("\n")+"\n";
test("realistic pre-closure fixture scored with timestamp limitation",()=>{
 const result=auditHistoricalCsv(csv(line("10/08/2024","Arsenal","Chelsea","H")),"2425");
 assert.equal(result.validFixtures,1);
 assert.equal(result.pinnacleClosing1x2Rows,1);
 assert.equal(result.pairedBet365ClosingRows,1);
 assert.equal(result.reliability,"HISTORICAL_PRE_CLOSURE_ARCHIVE");
 assert.equal(result.modelOutOfSampleVerified,false);
 assert.equal(result.valueBetsProven,false);
 assert.ok(result.pinnacleLogLoss>0);
 assert.ok(result.csvSha256.length===64);
});
test("missing Pinnacle quote does not create benchmark",()=>{
 const x=auditHistoricalCsv(csv(line("10/08/2024","Arsenal","Chelsea","H",["","","","2","3","4"])),"2425");
 assert.equal(x.pinnacleClosing1x2Rows,0);
 assert.equal(x.pinnacleBrier,null);
});
test("post-closure historic observations are flagged stale",()=>{
 const x=auditHistoricalCsv(csv(line("10/08/2025","Arsenal","Chelsea","H")),"2526");
 assert.equal(x.reliability,"POST_2025_07_23_PINNACLE_STALE_WARNING");
 assert.equal(x.postApiClosureRows,1);
});
test("implausible three-way overround rejected",()=>{
 const x=auditHistoricalCsv(csv(line("10/08/2024","Arsenal","Chelsea","H",["1.05","1.05","1.05","2","3","4"])),"2425");
 assert.equal(x.pinnacleClosing1x2Rows,0);
});
test("duplicates do not overweight result",()=>{
 const line1=line("10/08/2024","Arsenal","Chelsea","H");
 const x=auditHistoricalCsv(csv(line1,line1),"2425");
 assert.equal(x.validFixtures,1);
 assert.equal(x.invalidOrDuplicateRows,1);
});
test("date outside season is rejected",()=>{
 const x=auditHistoricalCsv(csv(line("10/08/2023","Arsenal","Chelsea","H")),"2425");
 assert.equal(x.validFixtures,0);
 assert.equal(x.invalidOrDuplicateRows,1);
});
test("RFC4180 quoted comma and BOM parse properly",()=>{
 const text="\uFEFF"+csv(line("10/08/2024",'"Arsenal, FC"',"Chelsea","H"));
 const x=parseCsv(text);assert.equal(x[0].HomeTeam,"Arsenal, FC");
});
test("fail on duplicate headers",()=>{
 assert.throws(()=>parseCsv("Date,Date,HomeTeam,AwayTeam,FTR\n2024,2024,A,B,H"),/DUPLICATE_CSV_COLUMN/);
});
test("malformed CSV and bad rows fail closed",()=>{
 assert.throws(()=>parseCsv('Date,HomeTeam,AwayTeam,FTR\n"unclosed'),/UNCLOSED_CSV_QUOTE/);
 assert.throws(()=>parseCsv(csv("E0,10/08/2024,Arsenal")),/CSV_FIELD_COUNT_MISMATCH/);
});
test("unsupported season prohibited",()=>{
 assert.throws(()=>auditHistoricalCsv(csv(line("10/08/2024","Arsenal","Chelsea","H")),"2122"),/UNSUPPORTED_SEASON/);
});