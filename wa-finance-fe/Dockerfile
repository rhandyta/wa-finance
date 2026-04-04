# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci && npm cache clean --force

# Copy source code
COPY . .

# Build static web export
ARG EXPO_PUBLIC_BASE_URL=http://localhost:3000
ENV EXPO_PUBLIC_BASE_URL=${EXPO_PUBLIC_BASE_URL}

RUN npx expo export --platform web --output-dir ./web --non-interactive

# Production stage
FROM nginx:alpine

# Copy static files from builder
COPY --from=builder /app/web /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
