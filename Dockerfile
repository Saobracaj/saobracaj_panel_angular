# Multi-stage build for Angular SSR application
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the application
RUN npm run build

# Production image, copy all the files and run the app
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 angular

# Copy the built application
COPY --from=builder --chown=angular:nodejs /app/dist/saobracaj_panel ./

# Copy package.json for runtime dependencies
COPY --from=deps --chown=angular:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=angular:nodejs /app/package.json ./package.json

# Switch to non-root user
USER angular

# Expose the port
EXPOSE 8080

# Start the server
CMD ["node", "server/server.mjs"]
