import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import {createTable,sitDown,startHand,act,leaveTable,publicState,legalActions,TableState,ActionType} from './poker/engine.js';

const app = express();
const server = createServer(app);
const prisma = new PrismaClient();
const origins = (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173').split(',').map(x => x.trim());
const secret = process.env.JWT_SECRET ?? 'DEV_ONLY_CHANGE_THIS_SECRET_BEFORE_DEPLOY';
app.use(helmet());
app.use(cors({ origin: true }));
app.use(express.json({ limit: '20kb' }));

type AuthRequest = Request & { userId?: string };
function auth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Faça login para continuar.' });
  try {
    const data = jwt.verify(token, secret) as { sub: string };
    req.userId = data.sub;
    next();
  } catch { return res.status(401).json({ error: 'Sessão inválida. Entre novamente.' }); }
}
const safeUser = (u: any) => ({ id: u.id, username: u.username, email: u.email, status: u.status, role: u.role, balance: Number(u.wallet?.balance ?? 0), createdAt: u.createdAt });
const sign = (id: string) => jwt.sign({ sub: id }, secret, { expiresIn: '7d' });

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'poker-house-api', mode: 'virtual-chips-only' }));

app.post('/api/auth/register', async (req, res) => {
  const parsed = z.object({ email:z.string().email().max(180), username:z.string().min(3).max(18).regex(/^[a-zA-Z0-9_]+$/), password:z.string().min(8).max(72) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Informe e-mail válido, usuário (3–18 caracteres) e senha com pelo menos 8 caracteres.' });
  const { email, username, password } = parsed.data;
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({ data: { email:email.toLowerCase(), username, passwordHash, wallet:{ create:{ balance:10000n } }, transactions:{ create:{ type:'GRANT_DEMO', amount:10000n, description:'Bônus inicial de demonstração' } } }, include:{ wallet:true } });
    res.status(201).json({ token:sign(user.id), user:safeUser(user) });
  } catch (e:any) {
    if (e?.code === 'P2002') return res.status(409).json({ error:'E-mail ou nome de usuário já está em uso.' });
    res.status(500).json({ error:'Não foi possível criar a conta.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const parsed = z.object({ login:z.string().min(1), password:z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error:'Informe usuário/e-mail e senha.' });
  const user = await prisma.user.findFirst({ where:{ OR:[{email:parsed.data.login.toLowerCase()},{username:parsed.data.login}] }, include:{wallet:true} });
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) return res.status(401).json({ error:'Usuário ou senha incorretos.' });
  if (user.status !== 'ACTIVE') return res.status(403).json({ error:'Conta suspensa. Procure o suporte.' });
  res.json({ token:sign(user.id), user:safeUser(user) });
});

app.get('/api/me', auth, async (req:AuthRequest,res) => {
  const user = await prisma.user.findUnique({ where:{id:req.userId}, include:{wallet:true} });
  if (!user) return res.status(404).json({error:'Conta não encontrada.'});
  res.json({user:safeUser(user)});
});

app.get('/api/wallet/history', auth, async (req:AuthRequest,res) => {
  const rows = await prisma.demoChipTransaction.findMany({ where:{userId:req.userId!}, orderBy:{createdAt:'desc'}, take:30 });
  res.json({transactions:rows.map(x=>({...x,amount:Number(x.amount)}))});
});

app.post('/api/rewards/claim', auth, async (req:AuthRequest,res) => {
  const start = new Date(); start.setHours(0,0,0,0);
  const prior = await prisma.demoChipTransaction.findFirst({where:{userId:req.userId,type:'DAILY_REWARD',createdAt:{gte:start}}});
  if (prior) return res.status(409).json({error:'Recompensa diária já resgatada.'});
  const result = await prisma.$transaction(async tx => {
    await tx.demoWallet.update({where:{userId:req.userId!},data:{balance:{increment:500n}}});
    await tx.demoChipTransaction.create({data:{userId:req.userId!,type:'DAILY_REWARD',amount:500n,description:'Recompensa diária fictícia'}});
    return tx.demoWallet.findUnique({where:{userId:req.userId!}});
  });
  res.json({balance:Number(result?.balance ?? 0),message:'500 fichas fictícias adicionadas.'});
});

app.get('/api/lobby', async (_req,res) => {
  const [tables,tournaments] = await Promise.all([
    prisma.pokerTable.findMany({where:{status:'WAITING'},orderBy:{createdAt:'asc'}}),
    prisma.tournament.findMany({where:{status:'SCHEDULED'},orderBy:{startsAt:'asc'}})
  ]);
  res.json({tables,tournaments});
});

// Demo table entry: chips are points only; no payout or cash value.
app.post('/api/tables/:id/join', auth, async (req:AuthRequest,res) => {
  const table = await prisma.pokerTable.findUnique({where:{id:req.params.id}});
  if (!table || table.status !== 'WAITING') return res.status(404).json({error:'Mesa indisponível.'});
  const buyIn = BigInt(table.buyIn);
  try {
    const wallet = await prisma.$transaction(async tx => {
      const current = await tx.demoWallet.findUnique({where:{userId:req.userId!}});
      if (!current || current.balance < buyIn) throw new Error('INSUFFICIENT');
      await tx.demoWallet.update({where:{userId:req.userId!},data:{balance:{decrement:buyIn}}});
      await tx.demoChipTransaction.create({data:{userId:req.userId!,type:'TABLE_BUY_IN',amount:-buyIn,referenceId:table.id,description:`Entrada na mesa ${table.name}`}});
      return tx.demoWallet.findUnique({where:{userId:req.userId!}});
    });
    res.json({message:'Entrada simulada confirmada.',balance:Number(wallet?.balance ?? 0),table});
  } catch(e:any) { res.status(e.message==='INSUFFICIENT'?400:500).json({error:e.message==='INSUFFICIENT'?'Saldo fictício insuficiente.':'Não foi possível entrar na mesa.'}); }
});

app.post('/api/tournaments/:id/register', auth, async (req:AuthRequest,res) => {
  const t = await prisma.tournament.findUnique({where:{id:req.params.id}});
  if (!t || t.status !== 'SCHEDULED') return res.status(404).json({error:'Torneio indisponível.'});
  try {
    const wallet = await prisma.$transaction(async tx => {
      const current = await tx.demoWallet.findUnique({where:{userId:req.userId!}});
      const fee = BigInt(t.entryChips);
      if (!current || current.balance < fee) throw new Error('INSUFFICIENT');
      await tx.demoWallet.update({where:{userId:req.userId!},data:{balance:{decrement:fee}}});
      await tx.demoChipTransaction.create({data:{userId:req.userId!,type:'TOURNAMENT_ENTRY',amount:-fee,referenceId:t.id,description:`Inscrição no torneio ${t.name}`}});
      await tx.tournamentRegistration.create({data:{userId:req.userId!,tournamentId:t.id}});
      return tx.demoWallet.findUnique({where:{userId:req.userId!}});
    });
    res.json({message:'Inscrição demonstrativa confirmada.',balance:Number(wallet?.balance ?? 0)});
  } catch(e:any) { res.status(e.message==='INSUFFICIENT'?400:409).json({error:e.message==='INSUFFICIENT'?'Saldo fictício insuficiente.':'Você já está inscrito ou não foi possível concluir.'}); }
});

app.get('/api/admin/overview', auth, async (req:AuthRequest,res) => {
  const user = await prisma.user.findUnique({where:{id:req.userId}});
  if (!user || user.role !== 'ADMIN') return res.status(403).json({error:'Acesso restrito à administração.'});
  const [users,tables,tournaments] = await Promise.all([prisma.user.count(),prisma.pokerTable.count(),prisma.tournament.count()]);
  res.json({users,tables,tournaments});
});


async function requireAdmin(userId:string) {
  return prisma.user.findFirst({where:{id:userId,role:'ADMIN',status:'ACTIVE'}});
}
app.get('/api/store/items', async (_req,res) => {
  const items=await prisma.storeItem.findMany({where:{active:true},orderBy:{priceChips:'asc'}});
  res.json({items});
});
app.get('/api/inventory', auth, async (req:AuthRequest,res) => {
  const items=await prisma.inventoryItem.findMany({where:{userId:req.userId},include:{item:true},orderBy:{acquiredAt:'desc'}});
  res.json({items});
});
app.post('/api/store/items/:id/buy', auth, async (req:AuthRequest,res) => {
  try {
    const result=await prisma.$transaction(async tx=>{
      const item=await tx.storeItem.findFirst({where:{id:req.params.id,active:true}});
      if(!item) throw new Error('NOT_FOUND');
      const wallet=await tx.demoWallet.findUnique({where:{userId:req.userId!}});
      if(!wallet || wallet.balance<BigInt(item.priceChips)) throw new Error('INSUFFICIENT');
      await tx.demoWallet.update({where:{userId:req.userId!},data:{balance:{decrement:BigInt(item.priceChips)}}});
      const owned=await tx.inventoryItem.findUnique({where:{userId_itemId:{userId:req.userId!,itemId:item.id}}});
      if(owned) throw new Error('OWNED');
      await tx.inventoryItem.create({data:{userId:req.userId!,itemId:item.id}});
      await tx.demoChipTransaction.create({data:{userId:req.userId!,type:'ADJUSTMENT',amount:-BigInt(item.priceChips),referenceId:item.id,description:`Compra de item virtual: ${item.name}`}});
      return tx.demoWallet.findUnique({where:{userId:req.userId!}});
    });
    res.json({message:'Item adicionado à sua coleção.',balance:Number(result?.balance??0)});
  } catch(e:any) {
    const code=e.message;
    res.status(code==='NOT_FOUND'?404:code==='INSUFFICIENT'?400:code==='OWNED'?409:500).json({error:code==='NOT_FOUND'?'Item indisponível.':code==='INSUFFICIENT'?'Saldo fictício insuficiente.':code==='OWNED'?'Você já possui este item.':'Não foi possível concluir a compra.'});
  }
});
app.get('/api/admin/users', auth, async (req:AuthRequest,res) => {
  if(!await requireAdmin(req.userId!)) return res.status(403).json({error:'Acesso restrito.'});
  const users=await prisma.user.findMany({select:{id:true,username:true,email:true,role:true,status:true,createdAt:true,wallet:{select:{balance:true}}},orderBy:{createdAt:'desc'},take:100});
  res.json({users:users.map(u=>({...u,wallet:{balance:Number(u.wallet?.balance??0)}}))});
});
app.patch('/api/admin/users/:id/status', auth, async (req:AuthRequest,res) => {
  if(!await requireAdmin(req.userId!)) return res.status(403).json({error:'Acesso restrito.'});
  const parsed=z.object({status:z.enum(['ACTIVE','SUSPENDED'])}).safeParse(req.body);
  if(!parsed.success) return res.status(400).json({error:'Status inválido.'});
  if(req.params.id===req.userId && parsed.data.status==='SUSPENDED') return res.status(400).json({error:'Não suspenda sua própria conta.'});
  await prisma.user.update({where:{id:req.params.id},data:{status:parsed.data.status}});
  res.json({message:'Status do jogador atualizado.'});
});
app.post('/api/admin/tables', auth, async (req:AuthRequest,res) => {
  if(!await requireAdmin(req.userId!)) return res.status(403).json({error:'Acesso restrito.'});
  const parsed=z.object({name:z.string().min(3).max(50),smallBlind:z.number().int().positive(),bigBlind:z.number().int().positive(),buyIn:z.number().int().positive(),maxPlayers:z.number().int().min(2).max(9)}).safeParse(req.body);
  if(!parsed.success || (parsed.success && parsed.data.bigBlind<=parsed.data.smallBlind)) return res.status(400).json({error:'Dados da mesa inválidos.'});
  const table=await prisma.pokerTable.create({data:parsed.data});
  io.to('lobby').emit('lobby:updated');
  res.status(201).json({table});
});
app.post('/api/admin/tournaments', auth, async (req:AuthRequest,res) => {
  if(!await requireAdmin(req.userId!)) return res.status(403).json({error:'Acesso restrito.'});
  const parsed=z.object({name:z.string().min(3).max(70),entryChips:z.number().int().nonnegative(),maxPlayers:z.number().int().min(2).max(500),startsAt:z.string().datetime()}).safeParse(req.body);
  if(!parsed.success) return res.status(400).json({error:'Dados do torneio inválidos.'});
  const tournament=await prisma.tournament.create({data:{...parsed.data,startsAt:new Date(parsed.data.startsAt)}});
  io.to('lobby').emit('lobby:updated');
  res.status(201).json({tournament});
});
app.post('/api/admin/store/items', auth, async (req:AuthRequest,res) => {
  if(!await requireAdmin(req.userId!)) return res.status(403).json({error:'Acesso restrito.'});
  const parsed=z.object({name:z.string().min(2).max(60),description:z.string().max(240),rarity:z.enum(['Comum','Raro','Épico','Lendário']),priceChips:z.number().int().positive(),imageKey:z.string().max(40).optional()}).safeParse(req.body);
  if(!parsed.success) return res.status(400).json({error:'Dados do item inválidos.'});
  const item=await prisma.storeItem.create({data:parsed.data});
  res.status(201).json({item});
});

const io = new Server(server,{cors:{origin:origins}});
const liveTables = new Map<string,TableState>();
async function persistGame(game:TableState){
  await prisma.pokerGameSnapshot.upsert({
    where:{tableId:game.id},
    create:{tableId:game.id,state:JSON.parse(JSON.stringify(game))},
    update:{state:JSON.parse(JSON.stringify(game))}
  });
}
async function broadcastGame(game:TableState){
  const room=`table:${game.id}`;
  const sockets=await io.in(room).fetchSockets();
  const state=publicState(game);
  for(const client of sockets){
    client.emit('table:state',state);
    const own=game.players.find(p=>p.id===client.data.userId);
    if(own && ['PREFLOP','FLOP','TURN','RIVER'].includes(game.street)) client.emit('table:private-cards',{cards:own.hole});
  }
}
async function restoreGames(){
  try{
    const rows=await prisma.pokerGameSnapshot.findMany();
    for(const row of rows){
      const state=row.state as unknown as TableState;
      if(state && state.id && Array.isArray(state.players) && Array.isArray(state.deck)) liveTables.set(state.id,state);
    }
    console.log(`Restored ${liveTables.size} poker table snapshots`);
  }catch(e){console.error('Could not restore game snapshots',e);}
}
io.use((socket,next)=>{
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('AUTH_REQUIRED'));
  try { const payload = jwt.verify(token,secret) as {sub:string}; (socket.data as any).userId=payload.sub; next(); }
  catch { next(new Error('INVALID_TOKEN')); }
});
io.on('connection',socket=>{
  socket.emit('server:hello',{message:'Poker House conectado',mode:'virtual-chips-only'});
  socket.on('lobby:subscribe',()=>socket.join('lobby'));
  socket.on('table:join',async(tableId:string)=>{
    try{
      if(typeof tableId!=='string'||tableId.length>80)return;
      const dbTable=await prisma.pokerTable.findUnique({where:{id:tableId}});
      const user=await prisma.user.findUnique({where:{id:socket.data.userId},include:{wallet:true}});
      if(!dbTable||!user||!user.wallet)throw new Error('Mesa ou conta não encontrada.');
      let game=liveTables.get(tableId);
      if(!game){game=createTable({id:dbTable.id,name:dbTable.name,smallBlind:dbTable.smallBlind,bigBlind:dbTable.bigBlind,maxPlayers:dbTable.maxPlayers});liveTables.set(tableId,game);}
      if(game.players.some(p=>p.id===user.id)){
        socket.join(`table:${tableId}`);socket.emit('table:state',publicState(game,user.id));return;
      }
      const buyIn=Math.min(Number(user.wallet.balance),dbTable.buyIn);
      if(buyIn<dbTable.bigBlind*2)throw new Error('Saldo insuficiente para sentar nesta mesa.');
      await prisma.$transaction(async tx=>{
        const wallet=await tx.demoWallet.findUnique({where:{userId:user.id}});
        if(!wallet||wallet.balance<BigInt(buyIn))throw new Error('Saldo fictício insuficiente.');
        await tx.demoWallet.update({where:{userId:user.id},data:{balance:{decrement:BigInt(buyIn)}}});
        await tx.demoChipTransaction.create({data:{userId:user.id,type:'TABLE_BUY_IN',amount:-BigInt(buyIn),referenceId:tableId,description:`Reserva de fichas na mesa ${dbTable.name}`}});
      });
      try{
        sitDown(game,{id:user.id,username:user.username,stack:buyIn});
      }catch(e){await prisma.$transaction(async tx=>{
        await tx.demoWallet.update({where:{userId:user.id},data:{balance:{increment:BigInt(buyIn)}}});
        await tx.demoChipTransaction.create({data:{userId:user.id,type:'TABLE_CASH_OUT',amount:BigInt(buyIn),referenceId:tableId,description:'Estorno de entrada na mesa'}});
      });throw e;}
      socket.join(`table:${tableId}`);
      if(game.players.length>=2&&['WAITING','COMPLETE'].includes(game.street))startHand(game);
      await persistGame(game);
      await broadcastGame(game);
      const current=game.players.find(p=>p.seat===game.currentSeat);
      if(current)io.to(`table:${tableId}`).emit('table:turn',{playerId:current.id,actions:legalActions(game,current.id)});
    }catch(e:any){socket.emit('table:error',{message:e.message||'Não foi possível entrar na mesa.'});}
  });
  socket.on('table:leave',async(tableId:string)=>{
    try{
      const game=liveTables.get(tableId);if(!game)throw new Error('Mesa não encontrada.');
      const player=game.players.find(p=>p.id===socket.data.userId);if(!player)throw new Error('Você não está nesta mesa.');
      if(!['WAITING','COMPLETE'].includes(game.street))throw new Error('Aguarde o fim da mão para sair.');
      const refund=player.stack;
      leaveTable(game,socket.data.userId);
      if(refund>0)await prisma.$transaction(async tx=>{
        await tx.demoWallet.update({where:{userId:socket.data.userId},data:{balance:{increment:BigInt(refund)}}});
        await tx.demoChipTransaction.create({data:{userId:socket.data.userId,type:'TABLE_CASH_OUT',amount:BigInt(refund),referenceId:tableId,description:`Saída da mesa ${game.name}` }});
      });
      await persistGame(game);
      socket.leave(`table:${tableId}`);
      socket.emit('table:left',{refund});
      await broadcastGame(game);
    }catch(e:any){socket.emit('table:error',{message:e.message||'Não foi possível sair da mesa.'});}
  });
  socket.on('table:action',async({tableId,action,amount}:{tableId:string;action:ActionType;amount?:number})=>{
    try{
      const game=liveTables.get(tableId);if(!game)throw new Error('Mesa não encontrada.');
      const state=act(game,socket.data.userId,action,amount||0);
      await persistGame(game);
      await broadcastGame(game);
      if(game.currentSeat!==null){
        const current=game.players.find(p=>p.seat===game.currentSeat);
        if(current)io.to(`table:${tableId}`).emit('table:turn',{playerId:current.id,actions:legalActions(game,current.id)});
      }else if(game.street==='COMPLETE')io.to(`table:${tableId}`).emit('table:hand-complete',{winners:game.winners});
    }catch(e:any){socket.emit('table:error',{message:e.message||'Ação inválida.'});}
  });
  socket.on('table:request-state',(tableId:string)=>{
    const game=liveTables.get(tableId);if(game)socket.emit('table:state',publicState(game,socket.data.userId));
  });
});
const port = Number(process.env.PORT ?? 3001);
restoreGames().finally(()=>server.listen(port,()=>console.log(`Poker House API listening on ${port}`)));
