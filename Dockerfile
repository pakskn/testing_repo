FROM node:20-alpine

WORKDIR /app

ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL

# Sirf package files copy (caching ke liye)
COPY package*.json ./

# Dependencies install (postinstall skip karein)
RUN npm ci --ignore-scripts

# Baaki saari files copy
COPY . .

# Prisma client generate (ab DATABASE_URL available hai)
RUN npx prisma generate

# Next.js build
RUN npm run build

# Final settings
ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "start"]
