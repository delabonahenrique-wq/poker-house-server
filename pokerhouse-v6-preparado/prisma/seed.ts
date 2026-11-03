import {PrismaClient} from '@prisma/client';
const prisma=new PrismaClient();
async function main(){
 if(await prisma.pokerTable.count()===0) await prisma.pokerTable.createMany({data:[
  {name:'Mesa Iniciante',smallBlind:10,bigBlind:20,buyIn:500,maxPlayers:6},
  {name:'Mesa Clássica',smallBlind:25,bigBlind:50,buyIn:1500,maxPlayers:6},
  {name:'Mesa High Stakes',smallBlind:100,bigBlind:200,buyIn:5000,maxPlayers:9}
 ]});
 if(await prisma.tournament.count()===0) await prisma.tournament.create({data:{name:'Freeroll de Boas-vindas',entryChips:0,maxPlayers:18,startsAt:new Date(Date.now()+86400000)}});
 if(await prisma.storeItem.count()===0) await prisma.storeItem.createMany({data:[
  {name:'Avatar Royal',description:'Avatar cosmético para seu perfil.',rarity:'Raro',priceChips:1200,imageKey:'crown'},
  {name:'Moldura Imperial',description:'Moldura especial para sua identidade.',rarity:'Épico',priceChips:2800,imageKey:'frame'},
  {name:'Emblema Lendário',description:'Emblema de coleção de edição especial.',rarity:'Lendário',priceChips:5000,imageKey:'star'}
 ]});
}
main().finally(()=>prisma.$disconnect());
