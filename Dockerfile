# Multi-stage production build for DevSpace Monolith
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install all dependencies including devDependencies for build
RUN npm ci

# Copy full source tree
COPY . .

# Build all workspaces (shared -> backend + frontend)
RUN npm run build

# Stage 2: Production runtime image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000
ENV HOST=0.0.0.0

# Install production dependencies only
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

RUN npm ci --omit=dev

# Copy compiled artifacts from builder stage
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/frontend/dist ./frontend/dist

# Create storage and database directories
RUN mkdir -p .data/storage/raw-uploads .data/storage/processed .data/pglite

EXPOSE 4000

CMD ["node", "backend/dist/server.js"]
