FROM node:22-alpine

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_SKIP_DOWNLOAD=true \
    NODE_ENV=production

WORKDIR /app

# Copy dependency definitions and prisma schema from backend
COPY backend/package*.json ./
COPY backend/prisma ./prisma/
COPY backend/.npmrc ./

# Install dependencies - skip optional (whatsapp-web.js) and scripts (puppeteer)
RUN npm ci --ignore-scripts --omit=optional

# Copy backend application code
COPY backend/ ./

# Explicitly generate Prisma Client
RUN npx prisma generate

EXPOSE 5000

# Run DB push at startup (when DATABASE_URL is available), then start server
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node server.js"]
