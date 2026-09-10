FROM node:22-slim

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    NODE_ENV=production

WORKDIR /app

# Copy dependency definitions and prisma schema from backend
COPY backend/package*.json ./
COPY backend/prisma ./prisma/

# Install dependencies cleanly without script failures
RUN npm install --ignore-scripts --omit=dev

# Copy backend application code
COPY backend/ ./

# Explicitly generate Prisma Client
RUN npx prisma generate

EXPOSE 5000

CMD npx prisma db push --accept-data-loss && npm start
