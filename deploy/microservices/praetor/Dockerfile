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

# Install the pinned Rust toolchain used by the PRAXIS Node addon.
ENV RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo \
    PATH=/usr/local/cargo/bin:$PATH
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
    | sh -s -- -y --profile minimal --default-toolchain 1.93.0

# Enable pnpm
RUN corepack enable
RUN corepack prepare pnpm@10.13.1 --activate

WORKDIR /usr/src/app

# --- 1. Copy All Workspace Files ---
COPY . .

# Install workspace dependencies, then build both native addons explicitly.
RUN pnpm install
RUN pnpm --filter scram-node build
RUN pnpm --filter praxis-node build:linux

# Stage only the runtime PRAXIS package files; Rust targets and sources stay in
# the builder image.
RUN mkdir -p /tmp/praxis-node-package \
    && cp apps/solvers/praxis-node/package.json \
        apps/solvers/praxis-node/index.js \
        apps/solvers/praxis-node/index.d.ts \
        apps/solvers/praxis-node/praxis-node.linux-x64-gnu.node \
        /tmp/praxis-node-package/

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
COPY --from=builder /tmp/praxis-node-package ./node_modules/praxis-node

# Ensure the library paths are set for scram-node
ENV LD_LIBRARY_PATH="/root/.local/lib/scram:/root/.local/lib"

# Set Env
ENV NODE_ENV=production

# Expose port (default NestJS port)
EXPOSE 3000

CMD ["node", "dist/src/main.js"]
