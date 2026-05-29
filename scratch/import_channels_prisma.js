const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  let jsonPath = path.join(__dirname, '..', 'upcoming_long_channels.json');
  if (!fs.existsSync(jsonPath)) {
    jsonPath = path.join(__dirname, 'upcoming_long_channels.json');
  }
  if (!fs.existsSync(jsonPath)) {
    jsonPath = path.join(process.cwd(), 'upcoming_long_channels.json');
  }
  
  if (!fs.existsSync(jsonPath)) {
    console.error(`Error: File 'upcoming_long_channels.json' could not be found at any expected path!`);
    process.exit(1);
  }

  console.log('Loading compiled channels from upcoming_long_channels.json...');
  const channels = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`Loaded ${channels.length} channels.`);

  let insertedCount = 0;
  let updatedCount = 0;
  let videoCount = 0;
  let duplicateCids = 0;

  console.log('Beginning database import...');
  const total = channels.length;

  for (let i = 0; i < channels.length; i++) {
    const ch = channels[i];
    const { channelId, channelName, channelHandle, thumbnailUrl, subscribers, totalVideos, totalViews, channelType, niche, daysSinceStart, avgViewsPerVideo, outlierScore, isMonetized, isFaceless, monthlyViews, videos } = ch;

    try {
      // 1. Check if already exists to calculate exact duplicate vs new counts
      const exists = await prisma.channel.findUnique({
        where: { channelId }
      });

      if (exists) {
        duplicateCids++;
      }

      // 2. Upsert Channel
      await prisma.channel.upsert({
        where: { channelId },
        update: {
          channelName,
          channelHandle,
          thumbnailUrl,
          subscribers,
          totalVideos,
          totalViews: BigInt(totalViews),
          niche,
          daysSinceStart,
          avgViewsPerVideo,
          outlierScore,
          isMonetized,
          isFaceless,
          monthlyViews: BigInt(monthlyViews),
          updatedAt: new Date()
        },
        create: {
          channelId,
          channelName,
          channelHandle,
          thumbnailUrl,
          subscribers,
          totalVideos,
          totalViews: BigInt(totalViews),
          channelType: channelType === 'long_form' ? 'long' : channelType === 'short_form' ? 'short' : channelType,
          niche,
          daysSinceStart,
          avgViewsPerVideo,
          outlierScore,
          isMonetized,
          isFaceless,
          monthlyViews: BigInt(monthlyViews),
          isActive: true
        }
      });

      if (exists) {
        updatedCount++;
      } else {
        insertedCount++;
      }

      // 3. Upsert Videos sequentially
      for (const vid of videos) {
        await prisma.video.upsert({
          where: { videoId: vid.videoId },
          update: {
            title: vid.title,
            thumbnailUrl: vid.thumbnailUrl,
            views: BigInt(vid.views),
            duration: vid.duration,
            publishedAt: vid.publishedAt ? new Date(vid.publishedAt) : null,
            language: vid.language
          },
          create: {
            videoId: vid.videoId,
            channelId,
            title: vid.title,
            thumbnailUrl: vid.thumbnailUrl,
            views: BigInt(vid.views),
            duration: vid.duration,
            publishedAt: vid.publishedAt ? new Date(vid.publishedAt) : null,
            language: vid.language
          }
        });
        videoCount++;
      }

      if ((i + 1) % 50 === 0 || i + 1 === total) {
        console.log(`Progress: ${i + 1}/${total} channels imported...`);
      }

    } catch (err) {
      console.error(`Error importing channel ${channelId} (${channelName}):`, err);
    }
  }

  console.log('\n--- Import Complete ---');
  console.log(`- New channels inserted: ${insertedCount}`);
  console.log(`- Existing channels updated: ${updatedCount}`);
  console.log(`- Matches (duplicates) already in database: ${duplicateCids}`);
  console.log(`- Total unique channels processed: ${channels.length}`);
  console.log(`- Videos upserted: ${videoCount}`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
