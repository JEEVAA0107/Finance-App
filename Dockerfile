FROM node:22-slim

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_SKIP_DOWNLOAD=true \
    NODE_ENV=production

WORKDIR /app

# Copy dependency definitions and prisma schema from backend
COPY backend/package*.json ./
COPY backend/prisma ./prisma/
COPY backend/.npmrc ./

# Install production deps only, skip optional (whatsapp-web.js) and postinstall scripts
RUN npm ci --ignore-scripts --omit=optional

# Copy backend application code
COPY backend/ ./

# Explicitly generate Prisma Client (needs binaryTargets in schema for slim/alpine)
RUN npx prisma generate

EXPOSE 5000

# Run DB schema sync at container startup, then launch server
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node server.js"]
