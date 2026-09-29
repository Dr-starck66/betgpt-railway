import test from 'node:test';
import assert from 'node:assert/strict';
import { selectiveScoreHedge, DEFAULT_SCORE_HEDGE_POLICY, type ScoreHedgePolicy } from './selective-score-hedge.ts';
const policy: ScoreHedgePolicy={...DEFAULT_SCORE_HEDGE_POLICY,status:'ACTIVE',segments:{...DEFAULT_SCORE_HEDGE_POLICY.segments,opponent21:{...DEFAULT_SCORE_HEDGE_POLICY.segments.opponent21,allowedMarkets:['1X2_H']}}};
const base={league:'LL' as const,market:'1X2_H' as const,mainOdds:2,mainStake:1,mainModelProb:.44,p11:.05,pOpponent21:.08,listed11Odds:6,listedOpponent21Odds:15};
test('rejects opponent 2-1 when total expected goals are too low',()=>{const d=selectiveScoreHedge({...base,scoringContext:{source:'MODEL_LAMBDA' as const,expectedHomeGoals:1.1,expectedAwayGoals:.8,bttsProb:.39,over25Prob:.30}},policy);assert.notEqual(d.selected?.selection,'OPPONENT_2_1')});
test('rejects opponent 2-1 when predicted loser has too little scoring expectation',()=>{const d=selectiveScoreHedge({...base,scoringContext:{source:'OBSERVED_XG' as const,expectedHomeGoals:1.6,expectedAwayGoals:.65,bttsProb:.48,over25Prob:.43}},policy);assert.notEqual(d.selected?.selection,'OPPONENT_2_1')});
test('allows opponent 2-1 only when scoring context is plausible',()=>{const d=selectiveScoreHedge({...base,scoringContext:{source:'OBSERVED_XG' as const,expectedHomeGoals:1.45,expectedAwayGoals:1.05,bttsProb:.52,over25Prob:.47}},policy);assert.equal(d.selected?.selection,'OPPONENT_2_1')});
test('1-1 remains in scope and is not blocked by the 2-1 gate',()=>{const d=selectiveScoreHedge({...base,p11:.16,listed11Odds:8,pOpponent21:.01,scoringContext:{source:'MODEL_LAMBDA' as const,expectedHomeGoals:1.2,expectedAwayGoals:.75,bttsProb:.38,over25Prob:.31}},policy);assert.equal(d.selected?.selection,'1-1')});
