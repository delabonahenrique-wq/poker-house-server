import test from 'node:test';
import assert from 'node:assert/strict';
import {bestHand,createTable,sitDown,startHand,act,publicState,Card} from './engine.js';
const c=(rank:number,suit:'♠'|'♥'|'♦'|'♣'):Card=>({rank:rank as any,suit});
test('detects royal flush',()=>{
 const score=bestHand([c(14,'♠'),c(13,'♠'),c(12,'♠'),c(11,'♠'),c(10,'♠'),c(2,'♥'),c(3,'♦')]);
 assert.equal(score.category,9);
});
test('detects wheel straight A-2-3-4-5',()=>{
 const score=bestHand([c(14,'♠'),c(2,'♥'),c(3,'♦'),c(4,'♣'),c(5,'♠'),c(9,'♥'),c(13,'♦')]);
 assert.equal(score.category,4);assert.deepEqual(score.kickers,[5]);
});
test('hides opponents hole cards before showdown',()=>{
 const t=createTable({id:'t',name:'test',smallBlind:5,bigBlind:10,maxPlayers:6});
 sitDown(t,{id:'a',username:'a',stack:500});sitDown(t,{id:'b',username:'b',stack:500});
 startHand(t);
 const state=publicState(t,'a');
 assert.ok(state.players.find(p=>p.id==='a')?.hole);
 assert.equal(state.players.find(p=>p.id==='b')?.hole,undefined);
 assert.equal((state as any).deck,undefined);
});
test('rejects check when facing a bet',()=>{
 const t=createTable({id:'t',name:'test',smallBlind:5,bigBlind:10,maxPlayers:6});
 sitDown(t,{id:'a',username:'a',stack:500});sitDown(t,{id:'b',username:'b',stack:500});
 startHand(t);
 const current=t.players.find(p=>p.seat===t.currentSeat)!;
 assert.throws(()=>act(t,current.id,'CHECK'),/CANNOT_CHECK_FACING_BET/);
});

test('plays a heads-up hand through all streets and conserves chips',()=>{
 const t=createTable({id:'h',name:'heads up',smallBlind:5,bigBlind:10,maxPlayers:2});
 sitDown(t,{id:'p1',username:'p1',stack:500});sitDown(t,{id:'p2',username:'p2',stack:500});
 startHand(t);assert.equal(t.street,'PREFLOP');assert.equal(t.currentSeat,0);
 act(t,'p1','CALL');act(t,'p2','CHECK');assert.equal(t.street,'FLOP');
 let guard=0;
 while(t.street!=='COMPLETE'&&guard++<20){const player=t.players.find(p=>p.seat===t.currentSeat)!;act(t,player.id,'CHECK');}
 assert.equal(t.street,'COMPLETE');assert.equal(t.pot,0);
 assert.equal(t.players.reduce((sum,p)=>sum+p.stack,0),1000);
});
