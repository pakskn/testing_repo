# 🎯 Niche Finder — YouTube Channel Research Tool
**Waqasalee.com** | Private access, admin-approved users

---

## Tech Stack
- **Frontend/Backend**: Next.js 14 (App Router) + TypeScript
- **Database**: PostgreSQL 15 (Docker) / SQLite (local dev)
- **Auth**: NextAuth.js v4 + Google OAuth
- **Styling**: Tailwind CSS
- **Data Collection**: Python + YouTube Data API v3
- **Deployment**: Docker + Coolify / Hostinger VPS + Traefik

---

## 📁 Project Structure
```
niche-finder/
├── next-app/                    # Next.js application
│   ├── app/                     # Pages + API routes
│   │   ├── api/auth/            # NextAuth Google OAuth
│   │   ├── api/channels/        # Public channel API
│   │   ├── api/admin/           # Admin CRUD APIs
│   │   ├── channels/            # Channel pages (long/short/real-time/terminated)
│   │   ├── admin/               # Admin panel pages
│   │   ├── signin/              # Google sign-in page
│   │   └── pending/             # Approval waiting page
│   ├── components/              # Reusable UI components
│   ├── lib/                     # Prisma client + Auth config
│   │   ├── prisma.ts            # DB singleton
│   │   └── auth.ts              # NextAuth authOptions
│   ├── prisma/                  # Database schema + migrations
│   ├── types/                   # TypeScript interfaces
│   ├── middleware.ts             # Route protection
│   └── package.json
├── data-collector/              # Python YouTube data scraper
│   ├── collector_local.py       # ID-based collector (quota-efficient)
│   ├── search_collector.py      # Keyword search collector
│   ├── new_viral_collector.py   # New/viral channel finder
│   └── requirements_local.txt
├── Dockerfile                   # Multi-stage production build
├── docker-compose.yml           # Local development
├── docker-compose.prod.yml      # Production (Traefik SSL)
├── docker-compose.coolify.yml   # Coolify deployment
├── .env.example                 # Environment variables template
└── .github/workflows/           # CI/CD
    └── deploy.yml
```

---

## 🚀 Deployment Guide

### Option A — Coolify (Recommended)

**1. Install Coolify on VPS:**
```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
# Access: http://YOUR_VPS_IP:8000
```

**2. Coolify Settings:**
```
Project Type:        Docker Compose
Repository:         pakskn/testing_repo
Branch:             main
Docker Compose File: docker-compose.coolify.yml
Base Directory:     /  (root)
```

**3. Environment Variables in Coolify:**
```
DB_USER=nicheuser
DB_PASSWORD=your_strong_password
DB_NAME=nichefinder
DATABASE_URL=postgresql://nicheuser:your_password@postgres:5432/nichefinder
YOUTUBE_API_KEY=your_key
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_secret
NEXTAUTH_SECRET=your_32char_secret
NEXTAUTH_URL=https://niches.waqasalee.com
ADMIN_EMAIL=mypakskn@gmail.com
```

**4. Domain → Port 3000**

**5. First Deploy Migration:**
```bash
docker exec niche_app npx prisma migrate deploy
```

---

### Option B — Hostinger VPS Direct (Docker + Traefik)

```bash
# 1. Clone
cd /var/www && git clone https://github.com/pakskn/testing_repo.git niche-finder
cd niche-finder

# 2. Create .env
cp .env.example .env && nano .env

# 3. External network
docker network create web

# 4. Deploy
docker-compose -f docker-compose.prod.yml up -d --build

# 5. Migrate DB
sleep 15 && docker exec niche_app npx prisma migrate deploy
```

---

## 📊 Data Collection

```bash
cd data-collector
pip install -r requirements_local.txt

# Search-based (uses ~350 API units per run)
python -X utf8 search_collector.py

# New/viral channels finder
python -X utf8 new_viral_collector.py

# Manual ID-based
python -X utf8 collector_local.py
```

**YouTube API Quota: 10,000 units/day**
- Old approach: 100 units/channel (SLOW)
- New approach: ~3 units/channel (FAST) ✅

**Cron job (VPS — roz raat 3 baje):**
```bash
0 3 * * * cd /var/www/niche-finder/data-collector && python -X utf8 search_collector.py >> /var/log/collector.log 2>&1
```

---

## 🔐 Authentication Flow
```
User visits site → Not logged in → /signin
→ Google OAuth → New user = "pending"
→ Admin approves at /admin/users → User = "active"
→ Full access granted
```

---

## 🛠️ Local Development (without Docker)

```bash
cd next-app
npm install
# Set DATABASE_URL in .env (use Neon.tech free PostgreSQL)
npx prisma db push
npx prisma db seed
npm run dev
# Opens: http://localhost:3000
```

---

## 📞 Support
Admin: mypakskn@gmail.com | Waqasalee.com
