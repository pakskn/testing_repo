with open('/home/waqas/niche-finder/.env', 'w') as f:
    f.write('''DATABASE_URL="postgresql://niche_user:N1ch3_P_2026_Secure_Db@localhost:5432/niche_db"
YOUTUBE_API_KEY=AIzaSyCvvD2z7Qm_TvLID5qXm4nJCApUJKGLJGg

# Google OAuth
GOOGLE_CLIENT_ID=86040942316-f20dk89ebbstuk045703d7ug7fqaovk1.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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

# NextAuth
NEXTAUTH_SECRET=niche-finder-secret-change-this-in-production
NEXTAUTH_URL=https://waqasalee.com

# Admin emails — auto-approved on sign-in (comma-separated)
ADMIN_EMAIL=mypakskn@gmail.com

# DB Config for docker-compose
DB_USER=niche_user
DB_PASSWORD=N1ch3_P_2026_Secure_Db
DB_NAME=niche_db
DOMAIN=waqasalee.com

UPSTASH_REDIS_REST_URL="https://humble-marlin-89407.upstash.io"
UPSTASH_REDIS_REST_TOKEN="gQAAAAAAAV0_AAIgcDFlMGY4OTQ1MzU1YmI0NWY0YTIyZTYwMDc5NWI3NTY2ZA"
''')
print("Successfully wrote .env on VPS!")
