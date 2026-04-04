# Build stage
FROM node:20-bullseye AS builder

WORKDIR /app

# Install all dependencies (including dev for puppeteer download)
COPY package*.json ./
RUN npm ci && npm cache clean --force

# Copy source code
COPY . .

# Production stage
FROM node:20-bullseye

WORKDIR /app

# Install system dependencies for:
# 1. Puppeteer/Chromium (whatsapp-web.js)
# 2. Python3 + pip (EasyOCR)
# 3. Image libraries (Jimp)
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Puppeteer/Chromium dependencies
    chromium \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libpango-1.0-0 \
    libgtk-3-0 \
    libxshmfence1 \
    libglu1 \
    # Python3 for EasyOCR
    python3 \
    python3-pip \
    python3-venv \
    # Image libraries
    libjpeg62-turbo \
    libpng16-16 \
    # Cleanup
    && rm -rf /var/lib/apt/lists/*

# Install EasyOCR via pip
RUN pip3 install --no-cache-dir easyocr

# Copy node_modules and app from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/src ./src

# Set Puppeteer to use system Chromium
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV PYTHON_BIN=python3

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["npm", "start"]
