/**
 * Poker House — Texas Hold'em engine.
 * All game state and card dealing stay server-side. Chips are fictional points.
 * No real-money wagering, cash-out, transfers, or prizes.
 */
export type Suit = '♠'|'♥'|'♦'|'♣';
export type Rank = 2|3|4|5|6|7|8|9|10|11|12|13|14;
export type Card = {rank:Rank;suit:Suit};
export type Street = 'WAITING'|'PREFLOP'|'FLOP'|'TURN'|'RIVER'|'SHOWDOWN'|'COMPLETE';
export type ActionType = 'FOLD'|'CHECK'|'CALL'|'BET'|'RAISE'|'ALL_IN';
export type Player = {
  id:string; username:string; seat:number; stack:number; committed:number; totalCommitted:number;
  folded:boolean; allIn:boolean; hole:Card[]; acted:boolean;
};
export type TableState = {
  id:string; name:string; smallBlind:number; bigBlind:number; maxPlayers:number;
  street:Street; handNumber:number; dealerSeat:number; currentSeat:number|null;
  currentBet:number; minRaise:number; pot:number; board:Card[]; deck:Card[];
  players:Player[]; actionLog:{playerId:string;action:ActionType;amount:number;at:number}[];
  winners:{playerId:string;amount:number;handName:string}[]; lastActionAt:number;
};
export type PublicPlayer = Omit<Player,'hole'|'totalCommitted'> & {hole?:Card[]};
export type PublicTable = Omit<TableState,'deck'|'players'> & {players:PublicPlayer[]};

const ranks:Rank[]=[2,3,4,5,6,7,8,9,10,11,12,13,14];
const suits:Suit[]=['♠','♥','♦','♣'];
const shuffledDeck=():Card[]=>{
 const deck:Card[]=suits.flatMap(s=>ranks.map(r=>({rank:r,suit:s})));
 for(let i=deck.length-1;i>0;i--){const j=randomInt(i+1);[deck[i],deck[j]]=[deck[j],deck[i]];}
 return deck;
};
// Rejection sampling avoids modulo bias. Node's crypto RNG is used on the server.
import {randomBytes} from 'node:crypto';
function randomInt(max:number):number{
 const limit=Math.floor(256/max)*max;
 let n:number; do{n=randomBytes(1)[0];}while(n>=limit);
 return n%max;
}
const nextSeat=(players:Player[],from:number,eligible=(p:Player)=>!p.folded&&p.stack>0):number=>{
 const sorted=players.filter(eligible).sort((a,b)=>a.seat-b.seat);
 if(!sorted.length) return -1;
 return sorted.find(p=>p.seat>from)?.seat ?? sorted[0].seat;
};
const playerAt=(t:TableState,seat:number)=>t.players.find(p=>p.seat===seat);
const active=(t:TableState)=>t.players.filter(p=>!p.folded);
const actionable=(t:TableState)=>t.players.filter(p=>!p.folded&&!p.allIn&&p.stack>0);
const countNotFolded=(t:TableState)=>active(t).length;
const addLog=(t:TableState,p:Player,a:ActionType,n:number)=>{t.actionLog.push({playerId:p.id,action:a,amount:n,at:Date.now()});t.lastActionAt=Date.now();};
function moveChips(t:TableState,p:Player,amount:number){
 const n=Math.max(0,Math.min(Math.floor(amount),p.stack));
 p.stack-=n;p.committed+=n;p.totalCommitted+=n;t.pot+=n;
 return n;
}
function deal(t:TableState):Card{
 const c=t.deck.pop();if(!c)throw new Error('DECK_EMPTY');return c;
}
function dealHoleCards(t:TableState){
 const eligible=t.players.filter(p=>!p.folded);
 for(let i=0;i<2;i++)for(const p of eligible)p.hole.push(deal(t));
}
function postBlind(t:TableState,seat:number,amount:number){
 const p=playerAt(t,seat);if(!p)return 0;
 const n=moveChips(t,p,amount);addLog(t,p,'BET',n);return n;
}
function resetStreetActions(t:TableState){for(const p of t.players)p.acted=p.folded||p.allIn;}
function nextActionableSeat(t:TableState,from:number):number{return nextSeat(t.players,from,p=>!p.folded&&!p.allIn&&p.stack>0);}
function roundComplete(t:TableState):boolean{
 const live=actionable(t);
 if(live.length<=1)return true;
 return live.every(p=>p.acted && p.committed===t.currentBet);
}
function awardUncontested(t:TableState){
 const winner=active(t)[0];if(!winner)return;
 winner.stack+=t.pot;t.winners=[{playerId:winner.id,amount:t.pot,handName:'Vitória sem disputa'}];
 t.pot=0;t.street='COMPLETE';t.currentSeat=null;
}
function burn(t:TableState){deal(t);}
function dealNextStreet(t:TableState){
 if(countNotFolded(t)<=1){awardUncontested(t);return;}
 if(t.street==='PREFLOP'){burn(t);t.board.push(deal(t),deal(t),deal(t));t.street='FLOP';}
 else if(t.street==='FLOP'){burn(t);t.board.push(deal(t));t.street='TURN';}
 else if(t.street==='TURN'){burn(t);t.board.push(deal(t));t.street='RIVER';}
 else if(t.street==='RIVER'){t.street='SHOWDOWN';resolveShowdown(t);return;}
 for(const p of t.players){p.committed=0;p.acted=p.folded||p.allIn;}
 t.currentBet=0;t.minRaise=t.bigBlind;
 const first=nextSeat(t.players,t.dealerSeat,p=>!p.folded&&!p.allIn&&p.stack>0);
 t.currentSeat=first<0?null:first;
 if(first<0){while(t.street!=='SHOWDOWN'&&t.street!=='COMPLETE')dealNextStreet(t);}
}
export function createTable(input:{id:string;name:string;smallBlind:number;bigBlind:number;maxPlayers:number}):TableState{
 if(input.smallBlind<1||input.bigBlind<=input.smallBlind||input.maxPlayers<2||input.maxPlayers>9)throw new Error('INVALID_TABLE_CONFIG');
 return { ...input,street:'WAITING',handNumber:0,dealerSeat:-1,currentSeat:null,currentBet:0,minRaise:input.bigBlind,pot:0,board:[],deck:[],players:[],actionLog:[],winners:[],lastActionAt:Date.now() };
}
export function sitDown(t:TableState,p:{id:string;username:string;stack:number}):PublicTable{
 if(t.street!=='WAITING'&&t.street!=='COMPLETE')throw new Error('HAND_IN_PROGRESS');
 if(t.players.some(x=>x.id===p.id))throw new Error('ALREADY_SEATED');
 if(t.players.length>=t.maxPlayers)throw new Error('TABLE_FULL');
 if(!Number.isSafeInteger(p.stack)||p.stack< t.bigBlind*2)throw new Error('STACK_TOO_SMALL');
 const seat=Array.from({length:t.maxPlayers},(_,i)=>i).find(i=>!t.players.some(x=>x.seat===i));
 if(seat===undefined)throw new Error('TABLE_FULL');
 t.players.push({id:p.id,username:p.username,seat,stack:p.stack,committed:0,totalCommitted:0,folded:false,allIn:false,hole:[],acted:false});
 return publicState(t);
}
export function leaveTable(t:TableState,playerId:string):PublicTable{
 const p=t.players.find(x=>x.id===playerId);if(!p)throw new Error('PLAYER_NOT_SEATED');
 if(!['WAITING','COMPLETE'].includes(t.street))throw new Error('CANNOT_LEAVE_DURING_HAND');
 t.players=t.players.filter(x=>x.id!==playerId);
 return publicState(t);
}
export function startHand(t:TableState):PublicTable{
 if(!['WAITING','COMPLETE'].includes(t.street))throw new Error('HAND_ALREADY_RUNNING');
 t.players=t.players.filter(p=>p.stack>0);
 if(t.players.length<2)throw new Error('NEED_TWO_PLAYERS');
 t.handNumber++;t.street='PREFLOP';t.deck=shuffledDeck();t.board=[];t.pot=0;t.currentBet=0;t.minRaise=t.bigBlind;t.winners=[];t.actionLog=[];
 for(const p of t.players){p.committed=0;p.totalCommitted=0;p.folded=false;p.allIn=false;p.acted=false;p.hole=[];}
 t.dealerSeat=nextSeat(t.players,t.dealerSeat,p=>true);
 const sbSeat=t.players.length===2?t.dealerSeat:nextSeat(t.players,t.dealerSeat,p=>true);
 const bbSeat=nextSeat(t.players,sbSeat,p=>true);
 postBlind(t,sbSeat,t.smallBlind);postBlind(t,bbSeat,t.bigBlind);
 t.currentBet=Math.max(...t.players.map(p=>p.committed));
 dealHoleCards(t);
 const first=t.players.length===2?t.dealerSeat:nextSeat(t.players,bbSeat,p=>!p.folded&&!p.allIn&&p.stack>0);
 t.currentSeat=first<0?null:first;
 if(!t.currentSeat && t.currentSeat!==0)dealNextStreet(t);
 return publicState(t);
}
export function act(t:TableState,playerId:string,action:ActionType,amount=0):PublicTable{
 if(!['PREFLOP','FLOP','TURN','RIVER'].includes(t.street))throw new Error('NO_ACTIVE_HAND');
 const p=t.players.find(x=>x.id===playerId);
 if(!p||p.seat!==t.currentSeat)throw new Error('NOT_YOUR_TURN');
 if(p.folded||p.allIn||p.stack<=0)throw new Error('PLAYER_CANNOT_ACT');
 const toCall=Math.max(0,t.currentBet-p.committed);
 if(action==='FOLD'){p.folded=true;p.acted=true;addLog(t,p,action,0);}
 else if(action==='CHECK'){
   if(toCall>0)throw new Error('CANNOT_CHECK_FACING_BET');
   p.acted=true;addLog(t,p,action,0);
 } else if(action==='CALL'){
   if(toCall===0)throw new Error('NOTHING_TO_CALL');
   const n=moveChips(t,p,toCall);p.acted=true;p.allIn=p.stack===0;addLog(t,p,action,n);
 } else if(action==='BET'||action==='RAISE'||action==='ALL_IN'){
   const requested=action==='ALL_IN'?p.stack:Math.floor(amount);
   if(!Number.isSafeInteger(requested)||requested<=0)throw new Error('INVALID_AMOUNT');
   const total=p.committed+Math.min(requested,p.stack);
   const raiseBy=total-t.currentBet;
   if(action==='BET'&&t.currentBet!==0)throw new Error('BET_NOT_ALLOWED');
   if(action==='RAISE'&&t.currentBet===0)throw new Error('RAISE_NOT_ALLOWED');
   if(raiseBy>0&&raiseBy<t.minRaise&&requested<p.stack)throw new Error('RAISE_TOO_SMALL');
   if(raiseBy<=0 && action!=='ALL_IN')throw new Error('RAISE_MUST_INCREASE');
   const oldBet=t.currentBet,n=moveChips(t,p,requested);
   p.allIn=p.stack===0;
   let fullRaise=false;
   if(p.committed>oldBet){t.currentBet=p.committed;if(p.committed-oldBet>=t.minRaise){t.minRaise=p.committed-oldBet;fullRaise=true;}}
   p.acted=true;
   // A short all-in increases the call amount but does not reopen action.
   if(fullRaise)for(const other of t.players)if(other.id!==p.id&&!other.folded&&!other.allIn&&other.committed<t.currentBet)other.acted=false;
   addLog(t,p,action,n);
 } else throw new Error('INVALID_ACTION');
 if(countNotFolded(t)===1){awardUncontested(t);return publicState(t);}
 if(roundComplete(t)){dealNextStreet(t);}
 else{
   const next=nextActionableSeat(t,p.seat);
   t.currentSeat=next<0?null:next;
   if(next<0)dealNextStreet(t);
 }
 return publicState(t);
}

type HandScore={category:number;kickers:number[];name:string};
const categoryNames=['Carta alta','Um par','Dois pares','Trinca','Sequência','Flush','Full house','Quadra','Straight flush','Royal flush'];
function evaluateFive(cards:Card[]):HandScore{
 const values=cards.map(c=>c.rank).sort((a,b)=>b-a);
 const counts=new Map<number,number>();values.forEach(v=>counts.set(v,(counts.get(v)||0)+1));
 const groups=[...counts.entries()].sort((a,b)=>b[1]-a[1]||b[0]-a[0]);
 const flush=cards.every(c=>c.suit===cards[0].suit);
 const unique=[...new Set(values)].sort((a,b)=>b-a);
 let straightHigh=0;
 if(unique.length===5){if(unique[0]-unique[4]===4)straightHigh=unique[0];else if(unique.join(',')==='14,5,4,3,2')straightHigh=5;}
 if(flush&&straightHigh===14)return {category:9,kickers:[14],name:categoryNames[9]};
 if(flush&&straightHigh)return {category:8,kickers:[straightHigh],name:categoryNames[8]};
 if(groups[0][1]===4)return {category:7,kickers:[groups[0][0],groups[1][0]],name:categoryNames[7]};
 if(groups[0][1]===3&&groups[1][1]===2)return {category:6,kickers:[groups[0][0],groups[1][0]],name:categoryNames[6]};
 if(flush)return {category:5,kickers:values,name:categoryNames[5]};
 if(straightHigh)return {category:4,kickers:[straightHigh],name:categoryNames[4]};
 if(groups[0][1]===3)return {category:3,kickers:[groups[0][0],...groups.slice(1).map(g=>g[0]).sort((a,b)=>b-a)],name:categoryNames[3]};
 if(groups[0][1]===2&&groups[1][1]===2)return {category:2,kickers:[Math.max(groups[0][0],groups[1][0]),Math.min(groups[0][0],groups[1][0]),groups[2][0]],name:categoryNames[2]};
 if(groups[0][1]===2)return {category:1,kickers:[groups[0][0],...groups.slice(1).map(g=>g[0]).sort((a,b)=>b-a)],name:categoryNames[1]};
 return {category:0,kickers:values,name:categoryNames[0]};
}
function compareScore(a:HandScore,b:HandScore):number{
 if(a.category!==b.category)return a.category-b.category;
 for(let i=0;i<Math.max(a.kickers.length,b.kickers.length);i++){const d=(a.kickers[i]||0)-(b.kickers[i]||0);if(d)return d;}
 return 0;
}
function combinations<T>(arr:T[],k:number):T[][]{
 if(k===0)return [[]];if(arr.length<k)return [];
 const [head,...tail]=arr;return [...combinations(tail,k-1).map(x=>[head,...x]),...combinations(tail,k)];
}
export function bestHand(cards:Card[]):HandScore{
 if(cards.length<5||cards.length>7)throw new Error('NEED_FIVE_TO_SEVEN_CARDS');
 return combinations(cards,5).map(evaluateFive).sort((a,b)=>compareScore(b,a))[0];
}
export function resolveShowdown(t:TableState):PublicTable{
 const contenders=active(t);
 if(contenders.length===1){awardUncontested(t);return publicState(t);}
 if(t.board.length!==5)throw new Error('BOARD_INCOMPLETE');
 const scored=contenders.map(p=>({p,score:bestHand([...p.hole,...t.board])}));
 // Side pots: each contribution level creates a separate pot. Folded contributions
 // remain in the pot, but folded players cannot win it.
 const levels=[...new Set(t.players.map(p=>p.totalCommitted).filter(x=>x>0))].sort((a,b)=>a-b);
 let previous=0;const awards=new Map<string,{amount:number;handName:string}>();
 for(const level of levels){
  const contributors=t.players.filter(p=>p.totalCommitted>=level);
  const pot=(level-previous)*contributors.length;previous=level;
  const eligible=scored.filter(x=>x.p.totalCommitted>=level);
  if(!eligible.length)continue;
  let best=eligible[0].score;
  for(const x of eligible)if(compareScore(x.score,best)>0)best=x.score;
  const winners=eligible.filter(x=>compareScore(x.score,best)===0).sort((a,b)=>a.p.seat-b.p.seat);
  const share=Math.floor(pot/winners.length),remainder=pot%winners.length;
  winners.forEach((x,i)=>{
   const add=share+(i<remainder?1:0);x.p.stack+=add;
   const prior=awards.get(x.p.id)||{amount:0,handName:x.score.name};
   awards.set(x.p.id,{amount:prior.amount+add,handName:x.score.name});
  });
 }
 // Any uncommitted chips are impossible in normal play; all committed amounts are accounted for.
 t.winners=[...awards.entries()].map(([playerId,v])=>({playerId,...v}));
 t.pot=0;t.street='COMPLETE';t.currentSeat=null;
 return publicState(t);
}
export function publicState(t:TableState,viewerId?:string):PublicTable{
 const {deck,...rest}=t;
 return {...rest,players:t.players.map(p=>{
  const {hole,totalCommitted,...publicPlayer}=p;
  return {...publicPlayer,...(viewerId===p.id||t.street==='SHOWDOWN'||t.street==='COMPLETE'?{hole}: {})};
 })};
}
export function legalActions(t:TableState,playerId:string){
 const p=t.players.find(x=>x.id===playerId);
 if(!p||p.seat!==t.currentSeat)return [];
 const call=Math.max(0,t.currentBet-p.committed);
 const options:ActionType[]=['FOLD'];
 if(call===0)options.push('CHECK');else options.push('CALL');
 if(p.stack>0)options.push('ALL_IN');
 if(p.stack>call+t.minRaise)options.push(t.currentBet===0?'BET':'RAISE');
 return options.map(action=>({action,toCall:call,minRaise:t.minRaise,maxAmount:p.stack}));
}
