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

# Install Dependencies (includes scram-node building via postinstall/bindings)
RUN pnpm install

# Build the App via Nx
RUN npx nx run praetor:build

# Prune dev dependencies to reduce size
# We save the scram-node build dir because prepublish from prune deletes local workspaces
RUN cp -r node_modules/scram-node/build /tmp/scram-build && \
    pnpm prune --prod --no-optional --ignore-scripts && \
    mkdir -p node_modules/scram-node/build && \
    cp -r /tmp/scram-build/* node_modules/scram-node/build/

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
COPY --from=builder /usr/src/app/apps/solvers/scram ./apps/solvers/scram

# Ensure the library paths are set for scram-node
ENV LD_LIBRARY_PATH="/root/.local/lib/scram:/root/.local/lib:${LD_LIBRARY_PATH}"

# Set Env
ENV NODE_ENV=production

# Expose port (default NestJS port)
EXPOSE 3000

CMD ["node", "dist/src/main.js"]
