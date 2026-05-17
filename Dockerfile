FROM node:20-alpine

WORKDIR /app

# Package files pehle copy (better caching)
COPY package*.json ./
RUN npm ci --only=production=false

# Saari files copy
COPY . .

# Prisma client generate
RUN npx prisma generate

# Next.js build
RUN npm run build

# Production settings
ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "start"]
