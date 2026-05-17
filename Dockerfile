FROM node:20-alpine

WORKDIR /app

# Package files copy
COPY package*.json ./

# Dependencies install (dev dependencies ke saath)
RUN npm ci

# Saari files copy
COPY . .

# Prisma generate
RUN npx prisma generate

# Next.js build
RUN npm run build

# Production settings
ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "start"]
