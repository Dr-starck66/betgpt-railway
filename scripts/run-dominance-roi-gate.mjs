import fs from 'node:fs/promises';
import { clamp, goalMatrix } from '../src/engine/math.ts';
import { pickCurrentMethod } from '../src/engine/pick.ts';
import { skipEuropeFrenchProno } from '../src/engine/french-clubs.ts';
import { discoverRoiChallenger, CONTINUOUS_ROI_CONFIG } from '../src/engine/continuous-portfolio-learning.ts';
import { portfolioMetrics, ruleMatches } from '../src/engine/portfolio-lab.ts';
import { selectiveScoreHedge, DEFAULT_SCORE_HEDGE_POLICY } from '../src/engine/selective-score-hedge.ts';
import { lowScoringNoBetGate } from '../src/engine/low-scoring-no-bet-gate.ts';

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
      const probs=[g.home,g.draw,g.away].sort((a,b)=>b-a);
      const dominanceMargin=pick.modelProb-(probs[1]??0);
      const scoringContext={source:'MODEL_LAMBDA',expectedHomeGoals:lh,expectedAwayGoals:la,zeroZeroProb:g.matrix[0][0],bttsProb:g.bttsYes,over25Prob:g.over25};
      const low=lowScoringNoBetGate(scoringContext);
      rows.push({id:h.id,kickoff:h.kickoff,league:h.league,market:pick.market,odds:pick.odds,modelProb:pick.modelProb,result:marketHits(pick.market,h.goalsHome,h.goalsAway),goalsHome:h.goalsHome,goalsAway:h.goalsAway,p11:g.matrix[1][1],pOpp21:g.matrix[opp[0]][opp[1]],oppScore:`${opp[0]}-${opp[1]}`,pHome:g.home,pDraw:g.draw,pAway:g.away,dominanceMargin,scoringContext,lowBlocked:low.blockBet});
    }
  }
  const score=h.goalsHome>h.goalsAway?1:h.goalsHome===h.goalsAway?.5:0; const exp=1/(1+Math.pow(10,(eA-(eH+55))/400)); const k=16;
  elo.set(h.homeId,clamp(eH+k*(score-exp),1350,2300)); elo.set(h.awayId,clamp(eA+k*((1-score)-(1-exp)),1350,2300));
 }
 return rows;
}
function baseRows(rows){return rows.filter(t=>t.odds>=1.8&&t.odds<=2.5)}
function gate(b,c,cfg){if(c.n<cfg.minBlockN)return false;if(c.roi<(cfg.minAbsoluteRoi??0))return false;if(c.roi<b.roi+cfg.minRoiLift)return false;if(c.profit<=0)return false;if(c.maxDrawdown>b.maxDrawdown*cfg.maxDrawdownMultiplier)return false;return true}
function selectPrequential(input){
 const cfg={...CONTINUOUS_ROI_CONFIG}; const tickets=input.filter(t=>!t.lowBlocked&&t.odds>=cfg.minOdds&&t.odds<=cfg.maxOdds).sort((a,b)=>a.kickoff.localeCompare(b.kickoff));
 const start=Math.min(Math.max(cfg.warmup,cfg.minTotalN),tickets.length);let champion=null;const selected=[],baseline=[];let promotions=0,rollbacks=0;
 for(let at=start;at<tickets.length;at+=cfg.retrainEvery){
   const hist=tickets.slice(0,at),future=tickets.slice(at,Math.min(tickets.length,at+cfg.retrainEvery)),recent=hist.slice(-Math.max(cfg.retrainEvery*2,700));
   const bmet=portfolioMetrics(baseRows(recent));const cand=discoverRoiChallenger(hist,cfg);const cmet=cand?portfolioMetrics(recent.filter(t=>ruleMatches(t,cand.rule))):null;let promoted=false;
   if(cand&&cmet&&gate(bmet,cmet,cfg)){champion=cand.rule;promotions++;promoted=true;}
   if(champion){const cm=portfolioMetrics(recent.filter(t=>ruleMatches(t,champion)));const degraded=cm.n>=cfg.minBlockN&&(cm.roi<Math.max(bmet.roi,cfg.minAbsoluteRoi??0)||cm.maxDrawdown>bmet.maxDrawdown*cfg.maxDrawdownMultiplier);if(degraded&&!promoted){champion=null;rollbacks++;}}
   baseline.push(...baseRows(future));if(champion)selected.push(...future.filter(t=>ruleMatches(t,champion)));
 }
 return {tickets,selected,baseline,promotions,rollbacks};
}
function calcMetrics(rows,withHedge){let wins=0,losses=0,profit=0,capital=0,equity=0,peak=0,dd=0,hedges=0,hedgeHits=0;
 for(const r of rows){const win=r.result==='win'; if(win)wins++;else losses++; let pnl=win?r.odds-1:-1; let stake=1;
   if(withHedge){const o11=fairCoverOdds(r.p11).odds, oOpp=fairCoverOdds(r.pOpp21).odds; const d=selectiveScoreHedge({league:r.league,market:r.market,mainOdds:r.odds,mainStake:1,mainModelProb:r.modelProb,p11:r.p11,pOpponent21:r.pOpp21,listed11Odds:o11,listedOpponent21Odds:oOpp,scoringContext:r.scoringContext},DEFAULT_SCORE_HEDGE_POLICY); const h=d.selected;
     if(h){const finalScore=`${r.goalsHome}-${r.goalsAway}`; const hit=h.scoreLabel===finalScore; pnl += hit?h.hedgeStake*(h.listedOdds-1):-h.hedgeStake; stake+=h.hedgeStake;hedges++;hedgeHits+=hit?1:0;}
   }
   profit+=pnl;capital+=stake;equity+=pnl;peak=Math.max(peak,equity);dd=Math.max(dd,peak-equity);
 }
 return {n:rows.length,wins,losses,hitRate:rows.length?wins/rows.length:0,profit,capital,roi:capital?profit/capital:0,maxDrawdown:dd,hedges,hedgeHits};}
const rows=rowsFromHistory();
const replay=selectPrequential(rows);
const baseSelected=replay.selected;
const gateMargin=0.08;
const minSegmentEvidence=15;
function applyGateChronological(seq, initial=[]) {
  const counts=new Map();
  for (const r of initial) if (r.dominanceMargin>=gateMargin) counts.set(r.league,(counts.get(r.league)??0)+1);
  const accepted=[];
  for (const r of seq) {
    const qualified=r.dominanceMargin>=gateMargin;
    if (qualified && (counts.get(r.league)??0)>=minSegmentEvidence) accepted.push(r);
    if (qualified) counts.set(r.league,(counts.get(r.league)??0)+1);
  }
  return accepted;
}
const gated=applyGateChronological(baseSelected);
const cut=Math.floor(baseSelected.length*.8);
const validationBase=baseSelected.slice(cut);
const development=baseSelected.slice(0,cut);
const devGated=applyGateChronological(development);
const validationGated=applyGateChronological(validationBase, development);
const report={
 version:'dominance-uncertainty-gate-v1',generatedAt:new Date().toISOString(),mode:'RESEARCH_SHADOW_ONLY',
 policy:{minDominanceMargin:gateMargin,minSegmentEvidence,rule:'dominance >= 0.08 AND at least 15 earlier dominance-qualified observations in the same league',lowXgNoBetApplied:true},
 rows:rows.length,lowXgBlocked:rows.filter(r=>r.lowBlocked).length,
 prequential:{baseline:calcMetrics(baseSelected,false),baselineHedged:calcMetrics(baseSelected,true),gated:calcMetrics(gated,false),gatedHedged:calcMetrics(gated,true)},
 development80:{baseline:calcMetrics(development,false),gated:calcMetrics(devGated,false)},
 chronologicalValidation20:{baseline:calcMetrics(validationBase,false),baselineHedged:calcMetrics(validationBase,true),gated:calcMetrics(validationGated,false),gatedHedged:calcMetrics(validationGated,true)},
 promotions:replay.promotions,rollbacks:replay.rollbacks,
 integrity:['Chronological replay only.','Low-xG 0-0-risk matches are excluded before learning and ROI.','Dominance gate uses probabilities available before kickoff.','The final chronological 20% block is reported separately. It is a validation slice, not an untouched external dataset.','Historical odds are synthetic/reconstructed; live promotion still requires real timestamped prices.']
};
report.prequential.roiLiftPlain=report.prequential.gated.roi-report.prequential.baseline.roi;
report.prequential.roiLiftHedged=report.prequential.gatedHedged.roi-report.prequential.baselineHedged.roi;
report.chronologicalValidation20.roiLiftPlain=report.chronologicalValidation20.gated.roi-report.chronologicalValidation20.baseline.roi;
report.chronologicalValidation20.roiLiftHedged=report.chronologicalValidation20.gatedHedged.roi-report.chronologicalValidation20.baselineHedged.roi;
await fs.writeFile(new URL('../data/dominance-uncertainty-gate-v1.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
