FROM node:20-alpine

WORKDIR /app

# Sirf package files copy (caching ke liye)
COPY package*.json ./

# Dependencies install
RUN npm ci

# Baaki saari files copy
COPY . .

# Prisma client generate
RUN npx prisma generate

# Next.js build
RUN npm run build

# Final settings
ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "start"]
