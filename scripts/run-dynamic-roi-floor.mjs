import fs from 'node:fs/promises';
import { clamp, goalMatrix } from '../src/engine/math.ts';
import { pickCurrentMethod } from '../src/engine/pick.ts';
import { skipEuropeFrenchProno } from '../src/engine/french-clubs.ts';
import { discoverRoiChallenger, CONTINUOUS_ROI_CONFIG } from '../src/engine/continuous-portfolio-learning.ts';
import { portfolioMetrics, ruleMatches } from '../src/engine/portfolio-lab.ts';
import { selectiveScoreHedge, DEFAULT_SCORE_HEDGE_POLICY } from '../src/engine/selective-score-hedge.ts';

function marketHits(m,gh,ga){if(m==='1X2_H')return gh>ga?'win':'lose';if(m==='1X2_A')return gh<ga?'win':'lose';return gh===ga?'win':'lose'}
function fairCoverOdds(p){return {odds:clamp(1.08/clamp(p,.035,.22),5,28)}}

const history=JSON.parse(await fs.readFile(new URL('../data/archive-history.json',import.meta.url),'utf8')).matches;
function lambdas(eH,eA){const d=(eH-eA+55)/900;return {lh:clamp(1.18*Math.pow(10,d*.55),.55,2.7),la:clamp(1.08*Math.pow(10,-d*.55),.5,2.5)}}
function price(p){return clamp(1/Math.max(p*1.05,.06),1.12,18)}
function rowsFromHistory(){
 const elo=new Map(); const get=id=>elo.get(id)??1700; const rows=[];
 for(const h of [...history].sort((a,b)=>a.kickoff.localeCompare(b.kickoff))){
  const eH=get(h.homeId),eA=get(h.awayId); const {lh,la}=lambdas(eH,eA); const g=goalMatrix(lh,la,-.1);
  const pick=pickCurrentMethod({home:g.home,draw:g.draw,away:g.away},{home:price(g.home),draw:price(g.draw),away:price(g.away)},{skipDraw:h.league==='CL'||h.league==='EL'});
  const homeName=h.homeName??h.homeId, awayName=h.awayName??h.awayId;
  if(pick && !skipEuropeFrenchProno({league:h.league,home:{id:h.homeId,name:homeName},away:{id:h.awayId,name:awayName}})){
    if((pick.market==='1X2_H'||pick.market==='1X2_A') && pick.odds>=1.8 && pick.odds<=3.0){
      const opp=pick.market==='1X2_H'?[1,2]:[2,1];
      rows.push({id:h.id,kickoff:h.kickoff,league:h.league,market:pick.market,odds:pick.odds,modelProb:pick.modelProb,result:marketHits(pick.market,h.goalsHome,h.goalsAway),goalsHome:h.goalsHome,goalsAway:h.goalsAway,p11:g.matrix[1][1],pOpp21:g.matrix[opp[0]][opp[1]],oppScore:`${opp[0]}-${opp[1]}`});
    }
  }
  const score=h.goalsHome>h.goalsAway?1:h.goalsHome===h.goalsAway?.5:0; const exp=1/(1+Math.pow(10,(eA-(eH+55))/400)); const k=16;
  elo.set(h.homeId,clamp(eH+k*(score-exp),1350,2300)); elo.set(h.awayId,clamp(eA+k*((1-score)-(1-exp)),1350,2300));
 }
 return rows;
}
function baseRows(rows){return rows.filter(t=>t.odds>=1.8&&t.odds<=2.5)}
function gate(b,c,cfg){if(c.n<cfg.minBlockN)return false;if(c.roi<b.roi+cfg.minRoiLift)return false;if(c.profit<=0)return false;if(c.maxDrawdown>b.maxDrawdown*cfg.maxDrawdownMultiplier)return false;return true}
function calcMetrics(rows,withHedge){let wins=0,losses=0,profit=0,capital=0,equity=0,peak=0,dd=0,hedges=0,hedgeHits=0,by={};
 for(const r of rows){const win=r.result==='win'; if(win)wins++;else losses++; let pnl=win?r.odds-1:-1; let stake=1;
   if(withHedge){const o11=fairCoverOdds(r.p11).odds, oOpp=fairCoverOdds(r.pOpp21).odds; const d=selectiveScoreHedge({league:r.league,market:r.market,mainOdds:r.odds,mainStake:1,mainModelProb:r.modelProb,p11:r.p11,pOpponent21:r.pOpp21,listed11Odds:o11,listedOpponent21Odds:oOpp},DEFAULT_SCORE_HEDGE_POLICY); const h=d.selected;
     if(h){const finalScore=`${r.goalsHome}-${r.goalsAway}`; const hit=h.scoreLabel===finalScore; pnl += hit?h.hedgeStake*(h.listedOdds-1):-h.hedgeStake; stake+=h.hedgeStake;hedges++;hedgeHits+=hit?1:0;by[h.scoreLabel]=(by[h.scoreLabel]??0)+1;}
   }
   profit+=pnl;capital+=stake;equity+=pnl;peak=Math.max(peak,equity);dd=Math.max(dd,peak-equity);
 }
 return {n:rows.length,wins,losses,hitRate:rows.length?wins/rows.length:0,profit,capital,roi:capital?profit/capital:0,maxDrawdown:dd,hedges,hedgeHits,hedgeHitRate:hedges?hedgeHits/hedges:0,by};}
function simulate(input,minOdds,warmupOverride=null){const cfg={...CONTINUOUS_ROI_CONFIG,minOdds}; const tickets=input.filter(t=>t.odds>=minOdds&&t.odds<=cfg.maxOdds).sort((a,b)=>a.kickoff.localeCompare(b.kickoff)); const start=warmupOverride==null?Math.min(Math.max(cfg.warmup,cfg.minTotalN),tickets.length):Math.min(Math.max(warmupOverride,cfg.minTotalN),tickets.length); let champion=null,prom=0,rb=0; const selected=[],baseSel=[];
 for(let at=start;at<tickets.length;at+=cfg.retrainEvery){const hist=tickets.slice(0,at),future=tickets.slice(at,Math.min(tickets.length,at+cfg.retrainEvery)),recent=hist.slice(-Math.max(cfg.retrainEvery*2,700));const bmet=portfolioMetrics(baseRows(recent));const cand=discoverRoiChallenger(hist,cfg);const cmet=cand?portfolioMetrics(recent.filter(t=>ruleMatches(t,cand.rule))):null;let promoted=false;if(cand&&cmet&&gate(bmet,cmet,cfg)){champion=cand.rule;prom++;promoted=true;}if(champion){const cm=portfolioMetrics(recent.filter(t=>ruleMatches(t,champion)));const degraded=cm.n>=cfg.minBlockN&&(cm.roi<bmet.roi||cm.maxDrawdown>bmet.maxDrawdown*cfg.maxDrawdownMultiplier);if(degraded&&!promoted){champion=null;rb++;}}
   baseSel.push(...baseRows(future));if(champion)selected.push(...future.filter(t=>ruleMatches(t,champion)));
 }
 return {minOdds,eligible:tickets.length,warmup:start,selectedN:selected.length,plain:calcMetrics(selected,false),hedged:calcMetrics(selected,true),baseline:calcMetrics(baseSel,false),promotions:prom,rollbacks:rb,finalChampion:champion};}

const rows=rowsFromHistory();
const full=simulate(rows,1.8);
const out={version:'dynamic-min-odds-v3-with-selective-hedge',generatedAt:new Date().toISOString(),mode:'RESEARCH_SHADOW_ONLY',rows:rows.length,plain:full.plain,hedged:full.hedged,baseline:full.baseline,promotions:full.promotions,rollbacks:full.rollbacks,finalChampion:full.finalChampion};
await fs.writeFile(new URL('../data/dynamic-min-odds-v3-hedge-report.json',import.meta.url),JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out,null,2));
