# ==============================================================================
# NEXORA — Production Multi-Stage Dockerfile
# "Enter the Grid. Outsmart the Network."
# ==============================================================================

# --- Stage 1: Build Workspace ---
FROM node:20-alpine AS builder

WORKDIR /app

# Install build prerequisites if necessary
RUN apk add --no-cache python3 make g++

# Copy package manifests for layer caching
COPY package.json package-lock.json* ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY client/package.json ./client/

# Install all dependencies (including devDependencies for TypeScript compilation)
RUN npm ci

# Copy source trees and configuration files
COPY shared/ ./shared/
COPY server/ ./server/
COPY client/ ./client/
COPY tsconfig*.json ./

# Build all monorepo workspaces (shared -> client -> server)
RUN npm run build

# --- Stage 2: Production Runtime ---
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Install curl/wget for healthcheck
RUN apk add --no-cache wget

# Create non-root system user for security
RUN addgroup -S nexora && adduser -S nexora -G nexora

# Copy package manifests
COPY package.json package-lock.json* ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY client/package.json ./client/

# Install only production dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled outputs from builder
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist

# Set file ownership to non-root user
RUN chown -R nexora:nexora /app

USER nexora

EXPOSE 4000

# Liveness probe via wget
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/api/health || exit 1

# Launch NEXORA authoritative server
CMD ["node", "server/dist/server.js"]
