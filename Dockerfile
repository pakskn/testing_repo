# ═══════════════════════════════════════════════════════
#  Niche Finder — Multi-Stage Production Dockerfile
#  Build context: repo root (files are at root now)
# ═══════════════════════════════════════════════════════

# ── Stage 1: Dependencies ────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# ── Stage 2: Builder ─────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Switch SQLite → PostgreSQL for production
RUN sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma || true

# Dummy vars for build time ONLY — real values injected at runtime
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV NEXTAUTH_SECRET="build-time-only"
ENV NEXTAUTH_URL="http://localhost:3000"

# Generate Prisma client (schema only, no DB connection)
RUN npx prisma generate

# Build Next.js standalone
RUN npm run build

# ── Stage 3: Runner ──────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache openssl curl python3 py3-pip
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

COPY --from=builder /app/public                              ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone  ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static      ./.next/static
COPY --from=builder /app/prisma                              ./prisma
COPY --from=builder /app/node_modules/.prisma                ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma                ./node_modules/@prisma

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000 || exit 1

CMD ["node", "server.js"]
