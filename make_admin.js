import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.user.updateMany({
    where: { email: 'mypakskn@gmail.com' },
    data: { role: 'admin', status: 'active' }
  });
  console.log('User made admin!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
