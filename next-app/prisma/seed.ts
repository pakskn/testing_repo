import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CHANNELS = [
  // ────────────────────────────────────────────────────────────────
  // REAL channel IDs (provided by user)
  // ────────────────────────────────────────────────────────────────
  {
    channelId: 'UC_x5XG1OV2P6uZZ5FSM9Ttw',
    channelName: 'Google Developers',
    channelHandle: '@googledevelopers',
    thumbnailUrl: null,
    subscribers: 1_180_000,
    totalVideos: 8_412,
    totalViews: BigInt(950_000_000),
    channelType: 'long_form',
    niche: 'Technology',
    daysSinceStart: 4_800,
    avgViewsPerVideo: 112_934,
    outlierScore: 0.10,  // RED — huge established channel, expected
    isMonetized: true,
    videos: [
      {
        videoId: 'gdev_seed_01',
        title: 'Building with Gemini AI — Google I/O 2024',
        thumbnailUrl: null,
        views: BigInt(2_400_000),
        duration: '45:22',
        publishedAt: new Date('2024-05-14'),
      },
      {
        videoId: 'gdev_seed_02',
        title: "What's New in Android 15",
        thumbnailUrl: null,
        views: BigInt(1_800_000),
        duration: '28:15',
        publishedAt: new Date('2024-02-10'),
      },
      {
        videoId: 'gdev_seed_03',
        title: "Flutter 3.19 — What's New",
        thumbnailUrl: null,
        views: BigInt(950_000),
        duration: '19:42',
        publishedAt: new Date('2024-01-05'),
      },
    ],
  },

  {
    channelId: 'UCVHdiHQH3JfaMiXMSsGJtOA',
    channelName: 'PhilipIpes',
    channelHandle: '@philipipes',
    thumbnailUrl: null,
    subscribers: 8_040,
    totalVideos: 61,
    totalViews: BigInt(9_737_857),
    channelType: 'short_form',
    niche: 'Sports',
    daysSinceStart: 53,
    avgViewsPerVideo: 159_637,
    outlierScore: 19.85,  // GREEN — 8k subs but 159k avg views!
    isMonetized: true,
    videos: [
      {
        videoId: 'phil_seed_01',
        title: 'This dribble is ILLEGAL 🔥 #basketball #shorts',
        thumbnailUrl: null,
        views: BigInt(614_450),
        duration: '0:58',
        publishedAt: new Date('2026-04-15'),
      },
      {
        videoId: 'phil_seed_02',
        title: 'How Steph Curry does it 😤 #nba #shorts',
        thumbnailUrl: null,
        views: BigInt(512_000),
        duration: '0:45',
        publishedAt: new Date('2026-04-10'),
      },
      {
        videoId: 'phil_seed_03',
        title: 'Every NBA defender HATES this move #shorts',
        thumbnailUrl: null,
        views: BigInt(489_300),
        duration: '0:52',
        publishedAt: new Date('2026-04-02'),
      },
    ],
  },

  {
    channelId: 'UCJXGnMFfMRGCJQSKFGIl5MA',
    channelName: 'True Crime Daily',
    channelHandle: '@truecrimedaily',
    thumbnailUrl: null,
    subscribers: 22_000,
    totalVideos: 145,
    totalViews: BigInt(18_260_000),
    channelType: 'long_form',
    niche: 'Crime',
    daysSinceStart: 320,
    avgViewsPerVideo: 125_931,
    outlierScore: 5.72,  // GREEN — solid outlier
    isMonetized: true,
    videos: [
      {
        videoId: 'crime_seed_01',
        title: 'The Vanishing — A Cold Case Reopened After 20 Years',
        thumbnailUrl: null,
        views: BigInt(1_820_000),
        duration: '34:15',
        publishedAt: new Date('2026-03-01'),
      },
      {
        videoId: 'crime_seed_02',
        title: 'Inside the Mind of a Serial Killer | Full Documentary',
        thumbnailUrl: null,
        views: BigInt(1_540_000),
        duration: '48:22',
        publishedAt: new Date('2026-02-12'),
      },
      {
        videoId: 'crime_seed_03',
        title: 'The Case Nobody Could Solve Until Now',
        thumbnailUrl: null,
        views: BigInt(1_200_000),
        duration: '28:45',
        publishedAt: new Date('2026-01-28'),
      },
    ],
  },

  {
    channelId: 'UCBcRF18a7Qf58cCRy5xuWwQ',
    channelName: 'History Explained',
    channelHandle: '@historyexplained',
    thumbnailUrl: null,
    subscribers: 5_600,
    totalVideos: 89,
    totalViews: BigInt(4_806_400),
    channelType: 'long_form',
    niche: 'History',
    daysSinceStart: 210,
    avgViewsPerVideo: 54_004,
    outlierScore: 9.64,  // GREEN — great ratio for a new channel
    isMonetized: true,
    videos: [
      {
        videoId: 'hist_seed_01',
        title: 'Why the Roman Empire REALLY Fell',
        thumbnailUrl: null,
        views: BigInt(890_000),
        duration: '22:18',
        publishedAt: new Date('2026-02-20'),
      },
      {
        videoId: 'hist_seed_02',
        title: 'The Dark Truth About Ancient Egypt',
        thumbnailUrl: null,
        views: BigInt(720_000),
        duration: '18:44',
        publishedAt: new Date('2026-01-15'),
      },
      {
        videoId: 'hist_seed_03',
        title: "Napoleon's Biggest Mistake — Animated",
        thumbnailUrl: null,
        views: BigInt(560_000),
        duration: '15:30',
        publishedAt: new Date('2025-12-08'),
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────
  // FAKE channels with realistic data (6 additional)
  // ────────────────────────────────────────────────────────────────
  {
    channelId: 'UCfakeFin001xxxxxxxxxx01',
    channelName: 'Finance Simplified',
    channelHandle: '@financesimplified',
    thumbnailUrl: null,
    subscribers: 12_400,
    totalVideos: 67,
    totalViews: BigInt(3_269_600),
    channelType: 'long_form',
    niche: 'Finance',
    daysSinceStart: 186,
    avgViewsPerVideo: 48_800,
    outlierScore: 3.94,  // YELLOW
    isMonetized: true,
    videos: [
      {
        videoId: 'fin_seed_01',
        title: 'How I Made $10k Passive Income in 6 Months',
        thumbnailUrl: null,
        views: BigInt(312_000),
        duration: '16:42',
        publishedAt: new Date('2026-04-01'),
      },
      {
        videoId: 'fin_seed_02',
        title: 'The ONLY Budget Template You Need in 2026',
        thumbnailUrl: null,
        views: BigInt(284_000),
        duration: '12:15',
        publishedAt: new Date('2026-03-14'),
      },
      {
        videoId: 'fin_seed_03',
        title: 'Stop Losing Money — 5 Investing Mistakes',
        thumbnailUrl: null,
        views: BigInt(198_000),
        duration: '14:28',
        publishedAt: new Date('2026-02-28'),
      },
    ],
  },

  {
    channelId: 'UCfakeCook002xxxxxxxxxx02',
    channelName: 'CookingSecrets',
    channelHandle: '@cookingsecrets',
    thumbnailUrl: null,
    subscribers: 980,
    totalVideos: 28,
    totalViews: BigInt(7_896_000),
    channelType: 'short_form',
    niche: 'Cooking',
    daysSinceStart: 38,
    avgViewsPerVideo: 282_000,
    outlierScore: 287.76,  // GREEN — MEGA outlier, 980 subs 282k avg views!
    isMonetized: false,    // below 1000 subs threshold
    videos: [
      {
        videoId: 'cook_seed_01',
        title: "The pasta trick restaurants don't want you to know 🍝 #shorts",
        thumbnailUrl: null,
        views: BigInt(1_820_000),
        duration: '0:48',
        publishedAt: new Date('2026-04-25'),
      },
      {
        videoId: 'cook_seed_02',
        title: 'Crispy chicken in 10 minutes 🔥 #shorts #cooking',
        thumbnailUrl: null,
        views: BigInt(1_340_000),
        duration: '0:55',
        publishedAt: new Date('2026-04-18'),
      },
      {
        videoId: 'cook_seed_03',
        title: 'This sauce will change your life 🤌 #foodshorts',
        thumbnailUrl: null,
        views: BigInt(980_000),
        duration: '0:42',
        publishedAt: new Date('2026-04-10'),
      },
    ],
  },

  {
    channelId: 'UCfakeHist003xxxxxxxxxx03',
    channelName: 'Dark History',
    channelHandle: '@darkhistory',
    thumbnailUrl: null,
    subscribers: 145_000,
    totalVideos: 412,
    totalViews: BigInt(127_720_000),
    channelType: 'long_form',
    niche: 'History',
    daysSinceStart: 890,
    avgViewsPerVideo: 310_000,
    outlierScore: 2.14,  // YELLOW — large channel but still decent ratio
    isMonetized: true,
    videos: [
      {
        videoId: 'dark_seed_01',
        title: 'The Experiment That Changed Science Forever',
        thumbnailUrl: null,
        views: BigInt(2_100_000),
        duration: '38:12',
        publishedAt: new Date('2026-03-20'),
      },
      {
        videoId: 'dark_seed_02',
        title: "The Hidden Side of WW2 Nobody Talks About",
        thumbnailUrl: null,
        views: BigInt(1_890_000),
        duration: '44:55',
        publishedAt: new Date('2026-02-05'),
      },
      {
        videoId: 'dark_seed_03',
        title: 'Secret Societies That Actually Existed',
        thumbnailUrl: null,
        views: BigInt(1_650_000),
        duration: '32:18',
        publishedAt: new Date('2026-01-12'),
      },
    ],
  },

  {
    channelId: 'UCfakeGame004xxxxxxxxxx04',
    channelName: 'Gaming Highlights',
    channelHandle: '@gaminghighlights',
    thumbnailUrl: null,
    subscribers: 89_000,
    totalVideos: 310,
    totalViews: BigInt(13_950_000),
    channelType: 'short_form',
    niche: 'Gaming',
    daysSinceStart: 540,
    avgViewsPerVideo: 45_000,
    outlierScore: 0.51,  // RED — large subs, avg views not keeping up
    isMonetized: true,
    videos: [
      {
        videoId: 'game_seed_01',
        title: 'This Minecraft speedrun broke the world record 🎮 #shorts',
        thumbnailUrl: null,
        views: BigInt(380_000),
        duration: '0:58',
        publishedAt: new Date('2026-04-22'),
      },
      {
        videoId: 'game_seed_02',
        title: 'Impossible GTA stunt 😱 #gaming #shorts',
        thumbnailUrl: null,
        views: BigInt(290_000),
        duration: '0:44',
        publishedAt: new Date('2026-04-08'),
      },
      {
        videoId: 'game_seed_03',
        title: 'When AI beats every human at chess #shorts',
        thumbnailUrl: null,
        views: BigInt(245_000),
        duration: '0:52',
        publishedAt: new Date('2026-03-30'),
      },
    ],
  },

  {
    channelId: 'UCfakeMind005xxxxxxxxxx05',
    channelName: 'Mind Academy',
    channelHandle: '@mindacademy',
    thumbnailUrl: null,
    subscribers: 3_100,
    totalVideos: 42,
    totalViews: BigInt(3_276_000),
    channelType: 'long_form',
    niche: 'Psychology',
    daysSinceStart: 127,
    avgViewsPerVideo: 78_000,
    outlierScore: 25.16,  // GREEN — 3.1k subs but 78k avg views!
    isMonetized: true,
    videos: [
      {
        videoId: 'mind_seed_01',
        title: 'Why Your Brain Lies to You Every Single Day',
        thumbnailUrl: null,
        views: BigInt(420_000),
        duration: '19:28',
        publishedAt: new Date('2026-04-12'),
      },
      {
        videoId: 'mind_seed_02',
        title: 'Dark Psychology Tricks Used Against You Daily',
        thumbnailUrl: null,
        views: BigInt(380_000),
        duration: '22:14',
        publishedAt: new Date('2026-03-25'),
      },
      {
        videoId: 'mind_seed_03',
        title: 'How to Read Anyone Instantly — Science Explained',
        thumbnailUrl: null,
        views: BigInt(340_000),
        duration: '17:55',
        publishedAt: new Date('2026-03-08'),
      },
    ],
  },

  {
    channelId: 'UCfakeTech006xxxxxxxxxx06',
    channelName: 'TechNews Daily',
    channelHandle: '@technewsdaily',
    thumbnailUrl: null,
    subscribers: 67_000,
    totalVideos: 890,
    totalViews: BigInt(72_980_000),
    channelType: 'terminated',
    niche: 'Technology',
    daysSinceStart: 1_200,
    avgViewsPerVideo: 82_000,
    outlierScore: 1.22,  // RED — channel terminated, views declining
    isMonetized: true,
    videos: [
      {
        videoId: 'tech_seed_01',
        title: 'The Rise and Fall of Twitter | Full Story',
        thumbnailUrl: null,
        views: BigInt(1_200_000),
        duration: '32:45',
        publishedAt: new Date('2025-06-10'),
      },
      {
        videoId: 'tech_seed_02',
        title: "Why I'm Switching From iPhone to Android in 2025",
        thumbnailUrl: null,
        views: BigInt(890_000),
        duration: '18:22',
        publishedAt: new Date('2025-05-20'),
      },
      {
        videoId: 'tech_seed_03',
        title: 'GPT-5 Is Here — Everything Changed',
        thumbnailUrl: null,
        views: BigInt(750_000),
        duration: '24:08',
        publishedAt: new Date('2025-04-15'),
      },
    ],
  },
]

async function main() {
  console.log('🌱 Starting database seed...\n')

  for (const ch of CHANNELS) {
    const { videos, ...channelFields } = ch

    await prisma.channel.upsert({
      where: { channelId: channelFields.channelId },
      update: {
        ...channelFields,
        updatedAt: new Date(),
      },
      create: {
        ...channelFields,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })

    for (const v of videos) {
      await prisma.video.upsert({
        where: { videoId: v.videoId },
        update: { views: v.views, title: v.title },
        create: { ...v, channelId: channelFields.channelId },
      })
    }

    const scoreEmoji =
      channelFields.outlierScore >= 5 ? '🟢' :
      channelFields.outlierScore >= 2 ? '🟡' : '🔴'

    console.log(
      `  ${scoreEmoji} ${channelFields.channelName.padEnd(22)} | ` +
      `${String(channelFields.subscribers).padStart(8)} subs | ` +
      `${channelFields.outlierScore}x outlier | ` +
      `${channelFields.channelType}`
    )
  }

  const channelCount = await prisma.channel.count()
  const videoCount   = await prisma.video.count()

  console.log(`\n✅ Seed complete! ${channelCount} channels, ${videoCount} videos in database.\n`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('Seed error:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
