import { Router, RequestHandler } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const catalog = [
  { kind: 'DECOR', name: 'Lustre Imperial', cost: 250n },
  { kind: 'EQUIPMENT', name: 'Mesa VIP', cost: 500n },
  { kind: 'BUILDING', name: 'Salão de Jogos', cost: 1200n },
  { kind: 'LAND', name: 'Terreno Premium', cost: 2000n }
] as const;

export function registerEmpireExtraRoutes(app: any, prisma: PrismaClient, auth: RequestHandler) {
  const r = Router();
  r.use(auth);

  r.post('/casinos/:id/staff/:staffId/train', async (req: any, res) => {
    const userId = req.userId as string;
    const casino = await prisma.casino.findFirst({ where: { id: req.params.id, ownerId: userId } });
    if (!casino) return res.status(404).json({ error: 'Cassino não encontrado.' });
    const staff = await prisma.casinoStaff.findFirst({ where: { id: req.params.staffId, casinoId: casino.id, ownerId: userId } });
    if (!staff) return res.status(404).json({ error: 'Funcionário não encontrado.' });
    if (staff.skill >= 10) return res.status(400).json({ error: 'Funcionário já atingiu o nível máximo.' });
    const cost = 75n;
    try {
      const trained = await prisma.$transaction(async tx => {
        const debit = await tx.empireWallet.updateMany({ where: { userId, balance: { gte: cost } }, data: { balance: { decrement: cost } } });
        if (!debit.count) throw new Error('INSUFFICIENT');
        const updated = await tx.casinoStaff.update({ where: { id: staff.id }, data: { skill: { increment: 1 }, experience: { increment: 100 } } });
        await tx.empireLedger.create({ data: { userId, type: 'STAFF_TRAINING', amount: -cost, referenceId: staff.id, description: 'Treinamento de funcionário virtual' } });
        return updated;
      });
      res.json({ staff: trained, message: 'Treinamento concluído.' });
    } catch (e: any) {
      res.status(e.message === 'INSUFFICIENT' ? 400 : 500).json({ error: e.message === 'INSUFFICIENT' ? 'Saldo insuficiente. São necessárias 75 moedas.' : 'Não foi possível treinar.' });
    }
  });

  r.post('/casinos/:id/assets', async (req: any, res) => {
    const userId = req.userId as string;
    const casino = await prisma.casino.findFirst({ where: { id: req.params.id, ownerId: userId } });
    if (!casino) return res.status(404).json({ error: 'Cassino não encontrado.' });
    const item = catalog.find(x => x.name === req.body?.name);
    if (!item) return res.status(400).json({ error: 'Item não existe no catálogo.' });
    try {
      const asset = await prisma.$transaction(async tx => {
        const debit = await tx.empireWallet.updateMany({ where: { userId, balance: { gte: item.cost } }, data: { balance: { decrement: item.cost } } });
        if (!debit.count) throw new Error('INSUFFICIENT');
        const created = await tx.empireAsset.create({ data: { ownerId: userId, casinoId: casino.id, kind: item.kind, name: item.name, purchaseCost: item.cost } });
        await tx.empireLedger.create({ data: { userId, type: 'BUILD', amount: -item.cost, referenceId: created.id, description: 'Compra de ativo: ' + item.name } });
        return created;
      });
      res.status(201).json({ asset, message: 'Ativo adicionado ao cassino.' });
    } catch (e: any) {
      res.status(e.message === 'INSUFFICIENT' ? 400 : 500).json({ error: e.message === 'INSUFFICIENT' ? 'Saldo insuficiente.' : 'Não foi possível comprar o ativo.' });
    }
  });

  r.get('/market/listings', async (_req, res) => {
    const listings = await prisma.marketListing.findMany({ where: { status: 'ACTIVE' }, include: { owner: { select: { username: true } }, asset: true }, orderBy: { createdAt: 'desc' }, take: 50 });
    res.json({ listings: listings.map((x: any) => ({ id: x.id, assetId: x.assetId, price: Number(x.price), seller: x.owner.username, asset: x.asset.name, createdAt: x.createdAt })) });
  });

  r.post('/market/listings', async (req: any, res) => {
    const parsed = z.object({ assetId: z.string().min(1), price: z.number().int().min(1).max(1000000) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Informe um ativo e preço válido.' });
    const userId = req.userId as string;
    const asset = await prisma.empireAsset.findFirst({ where: { id: parsed.data.assetId, ownerId: userId } });
    if (!asset) return res.status(404).json({ error: 'Ativo não encontrado.' });
    const existing = await prisma.marketListing.findUnique({ where: { assetId: asset.id } });
    if (existing?.status === 'ACTIVE') return res.status(409).json({ error: 'Este ativo já foi anunciado.' });
    const listing = existing
      ? await prisma.marketListing.update({ where: { id: existing.id }, data: { ownerId: userId, price: BigInt(parsed.data.price), status: 'ACTIVE' } })
      : await prisma.marketListing.create({ data: { ownerId: userId, assetId: asset.id, price: BigInt(parsed.data.price) } });
    res.status(201).json({ listing: { id: listing.id, price: Number(listing.price) }, message: 'Anúncio publicado.' });
  });

  r.post('/market/listings/:id/buy', async (req: any, res) => {
    const buyerId = req.userId as string;
    try {
      const result = await prisma.$transaction(async tx => {
        const listing = await tx.marketListing.findFirst({ where: { id: req.params.id, status: 'ACTIVE' } });
        if (!listing) throw new Error('UNAVAILABLE');
        if (listing.ownerId === buyerId) throw new Error('SELF');
        const claim = await tx.marketListing.updateMany({ where: { id: listing.id, status: 'ACTIVE' }, data: { status: 'SOLD' } });
        if (!claim.count) throw new Error('UNAVAILABLE');
        const debit = await tx.empireWallet.updateMany({ where: { userId: buyerId, balance: { gte: listing.price } }, data: { balance: { decrement: listing.price } } });
        if (!debit.count) throw new Error('INSUFFICIENT');
        await tx.empireWallet.upsert({ where: { userId: listing.ownerId }, create: { userId: listing.ownerId, balance: listing.price }, update: { balance: { increment: listing.price } } });
        await tx.empireAsset.update({ where: { id: listing.assetId }, data: { ownerId: buyerId, casinoId: null } });
        await tx.empireLedger.create({ data: { userId: buyerId, type: 'MARKET_PURCHASE', amount: -listing.price, referenceId: listing.id, description: 'Compra no mercado do Império' } });
        await tx.empireLedger.create({ data: { userId: listing.ownerId, type: 'MARKET_PURCHASE', amount: listing.price, referenceId: listing.id, description: 'Venda no mercado do Império' } });
        return { price: Number(listing.price) };
      });
      res.json({ ...result, message: 'Compra concluída; ativo transferido.' });
    } catch (e: any) {
      const code = e.message;
      const status = code === 'SELF' ? 400 : code === 'UNAVAILABLE' ? 404 : code === 'INSUFFICIENT' ? 400 : 500;
      res.status(status).json({ error: code === 'SELF' ? 'Você não pode comprar seu próprio anúncio.' : code === 'UNAVAILABLE' ? 'Anúncio indisponível ou já vendido.' : code === 'INSUFFICIENT' ? 'Saldo insuficiente.' : 'Não foi possível concluir a compra.' });
    }
  });

  r.get('/rankings', async (_req, res) => {
    const casinos = await prisma.casino.findMany({ orderBy: [{ reputation: 'desc' }, { level: 'desc' }, { createdAt: 'asc' }], take: 20, include: { owner: { select: { username: true } } } });
    res.json({ rankings: casinos.map((c: any, i: number) => ({ position: i + 1, casino: c.name, owner: c.owner.username, reputation: c.reputation, level: c.level })) });
  });

  app.use('/api/empire', r);
}
