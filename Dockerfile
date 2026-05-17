FROM node:20-alpine

# Working directory set karo
WORKDIR /app

# Saari files copy karo (root se)
COPY . .

# Dependencies install karo
RUN npm ci --only=production=false

# Next.js build karo
RUN npm run build

# Port expose
EXPOSE 3000

# Start command
CMD ["npm", "start"]
