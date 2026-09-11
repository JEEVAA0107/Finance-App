FROM node:22-slim

# Install OpenSSL - REQUIRED by Prisma schema engine to run
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_SKIP_DOWNLOAD=true \
    NODE_ENV=production

WORKDIR /app

# Copy dependency definitions and prisma schema first
COPY package*.json ./
COPY prisma ./prisma/
COPY .npmrc ./

# Install production deps only, skip optional (whatsapp-web.js) and postinstall scripts
RUN npm ci --ignore-scripts --omit=optional

# Copy the rest of the application code
COPY . .

# Generate Prisma Client for debian-openssl-3.0.x
RUN npx prisma generate

EXPOSE 5000

# Run DB schema sync at container startup, then launch server
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node server.js"]
