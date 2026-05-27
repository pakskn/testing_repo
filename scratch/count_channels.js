const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const all = await prisma.channel.count();
  const active = await prisma.channel.count({ where: { isActive: true } });
  
  const longActive = await prisma.channel.count({ where: { isActive: true, channelType: 'long' } });
  const shortActive = await prisma.channel.count({ where: { isActive: true, channelType: 'short' } });
  
  const longTotal = await prisma.channel.count({ where: { channelType: 'long' } });
  const shortTotal = await prisma.channel.count({ where: { channelType: 'short' } });

  console.log('Total Channels:', all);
  console.log('Active Channels:', active);
  console.log('---');
  console.log('Active Long Form:', longActive);
  console.log('Active Short Form:', shortActive);
  console.log('---');
  console.log('Total Long Form:', longTotal);
  console.log('Total Short Form:', shortTotal);
}

main().catch(console.error).finally(() => prisma.$disconnect());
