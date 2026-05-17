# 🎯 YouTube Niche Finder Tool

A YouTube channel research tool inspired by Nexlev's Niche Finder. Browse channels by type, filter by performance metrics, and spot outlier channels growing faster than their subscriber count suggests.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend + Backend | Next.js 14 (App Router) |
| Styling | Tailwind CSS |
| Database | PostgreSQL 15 |
| ORM | Prisma |
| Data Collection | Python 3 + YouTube Data API v3 |
| Deployment | Docker + docker-compose + Traefik |

---

## VPS Deployment Steps

### 1. Upload Project to VPS

```bash
git clone YOUR_REPO /var/www/niche-finder
cd /var/www/niche-finder
```

### 2. Create and Fill .env File

```bash
cp .env.example .env
nano .env
```

Fill in all values:
```
DB_USER=nicheuser
DB_PASSWORD=YOUR_STRONG_PASSWORD
DB_NAME=nichefinder
DATABASE_URL=postgresql://nicheuser:YOUR_STRONG_PASSWORD@postgres:5432/nichefinder
YOUTUBE_API_KEY=YOUR_YOUTUBE_API_KEY
DOMAIN=yourdomain.com
```

### 3. Create External Docker Network (if not already created)

```bash
docker network create web
```

### 4. Build and Start All Containers

```bash
docker-compose up -d --build
```

### 5. Run Database Migration

```bash
docker exec niche_app npx prisma migrate deploy
```

### 6. Install Python Dependencies and Run Data Collector

```bash
cd data-collector
pip install -r requirements.txt
python collector.py
```

---

## How to Add Channels

Edit `data-collector/channel_ids.txt`:

```
# Format: channel_id,niche,channel_type (leave type empty for auto-detect)
UCxxxxxxxxxxxxxxxxxxxxxx,Sports,long_form
UCyyyyyyyyyyyyyyyyyyyy,Finance
UCzzzzzzzzzzzzzzzzzzzz,Crime,short_form
```

Then run the collector again:
```bash
python collector.py
```

The script uses `ON CONFLICT DO UPDATE` — safe to run multiple times.

---

## How to Get a YouTube API Key

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project
3. Left menu → APIs & Services → Library
4. Search **YouTube Data API v3** → Enable
5. APIs & Services → Credentials → Create Credentials → API Key
6. Copy the key and paste in `.env`

---

## How to Find a YouTube Channel ID

- Open the YouTube channel
- URL format: `youtube.com/channel/UCxxxxxx`
- Or: About page → Share → Copy Channel ID

---

## Outlier Score Formula

```
Outlier Score = Average Views Per Video ÷ Subscribers

Color Coding:
  🟢 Green  — 5x and above  (viral potential high)
  🟡 Yellow — 2x to 5x      (moderate)
  🔴 Red    — below 2x      (normal)
```

---

## Channel Type Definitions

| Type | Definition |
|---|---|
| `long_form` | Videos with average duration 5+ minutes |
| `short_form` | YouTube Shorts (avg duration under 90 seconds) |
| `real_time` | Channels that uploaded within the last 2 days |
| `terminated` | Manually marked terminated channels |

---

## Useful Commands

```bash
# View app logs
docker logs niche_app -f

# View database logs
docker logs niche_db -f

# Restart app only
docker-compose restart nextjs

# Stop everything
docker-compose down

# Stop and remove volumes (WARNING: deletes all data)
docker-compose down -v

# Open Prisma Studio (database GUI)
docker exec -it niche_app npx prisma studio
```
