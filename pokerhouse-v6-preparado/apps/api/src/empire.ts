import { Router, RequestHandler } from 'express';
import { PrismaClient } from '@prisma/client';

export function registerEmpireRoutes(app: any, prisma: PrismaClient, auth: RequestHandler) {
  const router = Router();
  router.use(auth);

  router.get('/profile', async (req: any, res) => {
    const userId = req.userId as string;
    const wallet = await prisma.empireWallet.upsert({
      where: { userId }, create: { userId }, update: {}
    });
    const casinos = await prisma.casino.findMany({
      where: { ownerId: userId }, include: { staff: true, assets: true },
      orderBy: { createdAt: 'asc' }
    });
    const ledger = await prisma.empireLedger.findMany({
      where: { userId }, orderBy: { createdAt: 'desc' }, take: 25
    });
    res.json({ wallet: { balance: Number(wallet.balance) }, casinos, ledger: ledger.map(x => ({ ...x, amount: Number(x.amount) })), currency: 'Moedas do Império — fictícias' });
  });

  router.post('/casinos', async (req: any, res) => {
    const parsed = (await import('zod')).z.object({
      name: (await import('zod')).z.string().trim().min(3).max(32),
      theme: (await import('zod')).z.enum(['royal','modern','classic','neon']).default('royal'),
      primaryColor: (await import('zod')).z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#B88A35'),
      secondaryColor: (await import('zod')).z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#171717')
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Nome, tema ou cores inválidos.' });
    const userId = req.userId as string;
    try {
      const casino = await prisma.$transaction(async tx => {
        const wallet = await tx.empireWallet.upsert({ where:{userId}, create:{userId}, update:{} });
        const cost = 1000n;
        if (wallet.balance < cost) throw new Error('INSUFFICIENT');
        await tx.empireWallet.update({where:{userId},data:{balance:{decrement:cost}}});
        const created = await tx.casino.create({data:{ownerId:userId,...parsed.data}});
        await tx.empireLedger.create({data:{userId,type:'LAND_PURCHASE',amount:-cost,referenceId:created.id,description:'Fundação de novo cassino'}});
        return created;
      });
      res.status(201).json({ casino, message: 'Seu cassino foi fundado.' });
    } catch (e: any) {
      res.status(e.message === 'INSUFFICIENT' ? 400 : 500).json({ error: e.message === 'INSUFFICIENT' ? 'Você precisa de 1.000 Moedas do Império.' : 'Não foi possível fundar o cassino.' });
    }
  });

  router.post('/casinos/:id/staff', async (req: any, res) => {
    const roles = ['manager','reception','security','cleaning','marketing','maintenance'];
    const role = req.body?.role;
    if (!roles.includes(role)) return res.status(400).json({error:'Cargo inválido.'});
    const userId = req.userId as string;
    const casino = await prisma.casino.findFirst({where:{id:req.params.id,ownerId:userId}});
    if (!casino) return res.status(404).json({error:'Cassino não encontrado.'});
    const cost = 150n;
    try {
      const staff = await prisma.$transaction(async tx => {
        const wallet = await tx.empireWallet.upsert({where:{userId},create:{userId},update:{}});
        if(wallet.balance < cost) throw new Error('INSUFFICIENT');
        await tx.empireWallet.update({where:{userId},data:{balance:{decrement:cost}}});
        const hired = await tx.casinoStaff.create({data:{casinoId:casino.id,ownerId:userId,role,salary:0n}});
        await tx.empireLedger.create({data:{userId,type:'STAFF_HIRE',amount:-cost,referenceId:hired.id,description:'Contratação de funcionário virtual'}});
        return hired;
      });
      res.status(201).json({staff});
    } catch(e:any) {
      res.status(e.message==='INSUFFICIENT'?400:500).json({error:e.message==='INSUFFICIENT'?'Saldo insuficiente. São necessárias 150 moedas.':'Não foi possível contratar.'});
    }
  });

  router.post('/casinos/:id/marketing', async (req: any, res) => {
    const userId = req.userId as string;
    const casino = await prisma.casino.findFirst({where:{id:req.params.id,ownerId:userId}});
    if(!casino) return res.status(404).json({error:'Cassino não encontrado.'});
    const cost = 100n;
    try {
      const result = await prisma.$transaction(async tx => {
        const wallet = await tx.empireWallet.upsert({where:{userId},create:{userId},update:{}});
        if(wallet.balance < cost) throw new Error('INSUFFICIENT');
        await tx.empireWallet.update({where:{userId},data:{balance:{decrement:cost}}});
        const updated = await tx.casino.update({where:{id:casino.id},data:{reputation:Math.min(100,casino.reputation+3)}});
        await tx.empireLedger.create({data:{userId,type:'MARKETING',amount:-cost,referenceId:casino.id,description:'Campanha de marketing virtual'}});
        return updated;
      });
      res.json({casino:result,message:'Campanha concluída; reputação aumentou.'});
    } catch(e:any) {
      res.status(e.message==='INSUFFICIENT'?400:500).json({error:e.message==='INSUFFICIENT'?'Saldo insuficiente. São necessárias 100 moedas.':'Falha na campanha.'});
    }
  });

  app.use('/api/empire', router);
}

export async function awardEmpireHand(prisma: PrismaClient, tableId: string, handNumber: number, winners: {playerId:string;amount:number;handName:string}[]) {
  for (const winner of winners) {
    if (!winner.playerId || winner.amount <= 0) continue;
    const handRef = tableId + ':' + handNumber + ':' + winner.playerId;
    try {
      await prisma.$transaction(async tx => {
        await tx.worldHandReward.create({data:{userId:winner.playerId,handRef,amount:25n}});
        await tx.empireWallet.upsert({
          where:{userId:winner.playerId},
          create:{userId:winner.playerId,balance:25n},
          update:{balance:{increment:25n}}
        });
        await tx.empireLedger.create({
          data:{userId:winner.playerId,type:'HAND_WIN',amount:25n,referenceId:handRef,description:'Vitória confirmada em mão de poker'}
        });
      });
    } catch (e:any) {
      if (e?.code !== 'P2002') throw e;
    }
  }
}
