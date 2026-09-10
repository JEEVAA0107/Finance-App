FROM node:22-slim

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    NODE_ENV=production

WORKDIR /app

# Copy dependency definitions and prisma schema first
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies cleanly without script failures
RUN npm install --ignore-scripts --omit=dev

# Copy the rest of the application code
COPY . .

# Explicitly generate Prisma Client
RUN npx prisma generate

EXPOSE 5000

CMD npx prisma db push --accept-data-loss && npm start
