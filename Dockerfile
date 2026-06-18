# Multi-stage build for production optimization
FROM node:18-bullseye-slim AS base

# Install system dependencies (Python3 for yt-dlp, FFmpeg for watermarking, curl to get yt-dlp)
RUN apt-get update && apt-get install -y \
    python3 \
    ffmpeg \
    curl \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Install the latest official yt-dlp binary from GitHub releases
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

# Install dependencies first (for layer caching)
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy the rest of the application
COPY . .

# Build Next.js
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

COPY --from=base /app /app

EXPOSE 3000

# Default CMD is to run the Next.js web application.
# Render background worker will override CMD to: npx tsx worker/index.ts
CMD ["npm", "run", "start"]
