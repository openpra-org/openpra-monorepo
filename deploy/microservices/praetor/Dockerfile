# Dockerfile.lightweight

# ------------------------------------------------------------------------------
# Stage 1: Builder (Heavy)
# ------------------------------------------------------------------------------
FROM node:20-slim AS builder

# Install Build Tools for C++ Addon
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ cmake git \
    ca-certificates curl gnupg \
    libxml2-dev libomp-dev \
    libboost-all-dev \
    libjemalloc-dev \
    && update-ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Enable pnpm
RUN corepack enable

WORKDIR /usr/src/app

# --- 1. Copy All Workspace Files ---
COPY . .

# Install workspace dependencies, then build the native SCRAM addon explicitly.
RUN pnpm install
RUN pnpm --filter scram-node build

# Build the App via Nx
RUN npx nx run praetor:build

# Prune dev dependencies to reduce size. The built workspace addon is copied
# into the runtime image separately below.
RUN pnpm prune --prod --no-optional --ignore-scripts

# ------------------------------------------------------------------------------
# Stage 2: Runner (Lightweight)
# ------------------------------------------------------------------------------
FROM node:20-slim

# Install ONLY Runtime Shared Libraries
# These are required by the C++ addon (scram-node)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libxml2 \
    libboost-filesystem1.74.0 \
    libboost-program-options1.74.0 \
    libjemalloc2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Copy built artifacts from builder
COPY --from=builder /usr/src/app/node_modules ./node_modules  
COPY --from=builder /usr/src/app/apps/microservices/praetor/dist ./dist
COPY --from=builder /usr/src/app/apps/solvers/scram ./node_modules/scram-node

# Ensure the library paths are set for scram-node
ENV LD_LIBRARY_PATH="/root/.local/lib/scram:/root/.local/lib"

# Set Env
ENV NODE_ENV=production

# Expose port (default NestJS port)
EXPOSE 3000

CMD ["node", "dist/src/main.js"]
