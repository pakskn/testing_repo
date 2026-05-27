import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  const batchFile = path.resolve('batch_all.json');
  console.log('Reading:', batchFile);
  
  if (!fs.existsSync(batchFile)) {
    console.error('batch_all.json not found!');
    return;
  }

  const batchData = JSON.parse(fs.readFileSync(batchFile, 'utf8'));
  let insertedChannels = 0;
  let insertedVideos = 0;

  for (const channelData of batchData) {
    try {
      if (!channelData.videos || channelData.videos.length === 0) {
        continue;
      }

      const payload = {
        channelId: channelData.channelId,
        channelName: channelData.channelName,
        channelHandle: channelData.channelHandle || '',
        thumbnailUrl: channelData.avatar || '',
        subscribers: channelData.subscribers || 0,
        totalVideos: channelData.videos.length || 0,
        totalViews: BigInt(0),
        channelType: 'long',
        niche: channelData.niche && channelData.niche !== 'Unknown' ? channelData.niche : 'Education',
        isActive: true,
        daysSinceStart: 100, // placeholder
        outlierScore: channelData.outlierScore || 0,
        isFaceless: true,
        isEntertainment: false,
      };

      await prisma.channel.upsert({
        where: { channelId: payload.channelId },
        update: payload,
        create: payload,
      });
      insertedChannels++;

      for (const v of channelData.videos) {
        const videoPayload = {
          videoId: v.videoId,
          channelId: payload.channelId,
          title: v.title,
          thumbnailUrl: v.thumbnailUrl || '',
          views: BigInt(v.views || 0),
          duration: v.duration,
          publishedAt: v.publishedAt ? new Date(v.publishedAt) : new Date(),
          isShort: false,
        };

        await prisma.video.upsert({
          where: { videoId: videoPayload.videoId },
          update: videoPayload,
          create: videoPayload,
        });
        insertedVideos++;
      }
    } catch (err) {
      console.error(`Error processing ${channelData.channelName}:`, err.message);
    }
  }

  console.log(`Finished inserting ${insertedChannels} channels and ${insertedVideos} videos from batch_all.json.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
