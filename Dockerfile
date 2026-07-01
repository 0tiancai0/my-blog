# ---- Build Stage ----
FROM node:22-alpine AS builder

WORKDIR /app

# TinaCMS build-time credentials
ARG TINA_CLIENT_ID
ARG TINA_TOKEN
ARG TINA_SEARCH_TOKEN
ENV TINA_CLIENT_ID=${TINA_CLIENT_ID}
ENV TINA_TOKEN=${TINA_TOKEN}
ENV TINA_SEARCH_TOKEN=${TINA_SEARCH_TOKEN}

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
# Increase Node memory limit for TinaCMS build
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build

# ---- Production Stage ----
FROM node:22-alpine

WORKDIR /app

# Install wget for healthcheck
RUN apk add --no-cache wget

# Copy built output + full node_modules (Astro SSR needs all transitive deps at runtime)
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Copy static public files
COPY --from=builder /app/public ./public

# Create uploads directory
RUN mkdir -p public/uploads

EXPOSE 4321

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321

CMD ["node", "dist/server/entry.mjs"]
