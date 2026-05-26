import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  const channels = await prisma.channel.findMany({
    where: { channelType: 'long' },
    include: { videos: true }
  });
  
  console.log("Total channels from Prisma:", channels.length);
  
  let validChannels = 0;
  for (const ch of channels) {
    const noShorts = ch.videos.filter(v => {
      // durationToSeconds logic
      if (!v.duration) return false;
      const parts = v.duration.split(':').map(Number);
      let sec = 0;
      if (parts.length === 3) sec = parts[0] * 3600 + parts[1] * 60 + parts[2];
      else if (parts.length === 2) sec = parts[0] * 60 + parts[1];
      else sec = parts[0] || 0;
      return sec > 60;
    });
    
    if (noShorts.length > 0) {
      validChannels++;
    }
  }
  
  console.log("Valid channels after filtering noShorts:", validChannels);
}

check().catch(console.error).finally(() => prisma.$disconnect());
