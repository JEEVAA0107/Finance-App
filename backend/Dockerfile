FROM node:22-bullseye-slim

# Install Chromium and required fonts/libraries from Debian official repositories
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       chromium \
       fonts-freefont-ttf \
       libxss1 \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Generate Prisma client
RUN npx prisma generate

EXPOSE 5000

CMD npx prisma db push --accept-data-loss && npm start
