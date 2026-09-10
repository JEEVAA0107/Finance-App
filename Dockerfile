FROM node:22-slim

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    NODE_ENV=production

WORKDIR /app

COPY backend/package*.json ./
RUN npm install --omit=dev

COPY backend/ ./

# Generate Prisma client
RUN npx prisma generate

EXPOSE 5000

CMD npx prisma db push --accept-data-loss && npm start
