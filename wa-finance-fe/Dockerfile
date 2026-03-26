# Build stage
FROM node:20-bullseye AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build static web export
ARG EXPO_PUBLIC_BASE_URL=http://backend:3000
ENV EXPO_PUBLIC_BASE_URL=${EXPO_PUBLIC_BASE_URL}

# Export web static files to ./web directory
RUN npx expo export --platform web --output-dir ./web --non-interactive

# Production stage with nginx
FROM nginx:alpine

# Copy static files from builder
COPY --from=builder /app/web /usr/share/nginx/html

# Copy custom nginx config if exists (optional)
# COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]