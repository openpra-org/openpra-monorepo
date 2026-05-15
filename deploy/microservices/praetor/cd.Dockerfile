# ------------------------------------------------------------------------------
# Stage 1: Builder
# ------------------------------------------------------------------------------
FROM node:20.17.0-slim AS builder

ENV DEBIAN_FRONTEND=noninteractive

# Install build tools and dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ cmake git \
    ca-certificates curl gnupg \
    libxml2-dev libomp-dev \
    libboost-all-dev \
    libgoogle-perftools-dev libboost-program-options-dev \
    libboost-math-dev libboost-random-dev libboost-filesystem-dev \
    libboost-test-dev libboost-date-time-dev libjemalloc-dev \
    && update-ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /data/project

# --- 1. Build scram-node first ---
COPY scram-node ./scram-node

WORKDIR /data/project/scram-node
RUN npm install && npm run install

# --- 2. Build NestJS App ---
WORKDIR /data/project

# Copy app source
COPY src ./src
COPY config ./config
COPY package.json tsconfig.json tsconfig.build.json nest-cli.json ./

# Install app dependencies (this will link scram-node via "file:./scram-node")
RUN npm install

# Patch TypeScript for Typia
RUN ./node_modules/.bin/ts-patch install -s

# Build the app
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# ------------------------------------------------------------------------------
# Stage 2: Runtime
# ------------------------------------------------------------------------------
FROM node:20.17.0-slim AS runtime

ENV DEBIAN_FRONTEND=noninteractive

# Install ONLY runtime shared libraries and curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    libxml2 \
    libboost-filesystem1.74.0 \
    libboost-program-options1.74.0 \
    libtcmalloc-minimal4 \
    libjemalloc2 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /data/project

# Copy built artifacts from builder
COPY --from=builder /data/project/node_modules ./node_modules
COPY --from=builder /data/project/dist ./dist
COPY --from=builder /data/project/scram-node ./scram-node
COPY --from=builder /data/project/package.json ./package.json

# Copy entrypoint
COPY docker/entrypoint.sh /
RUN chmod +x /entrypoint.sh

ENV NODE_ENV=production

EXPOSE 3000

ENTRYPOINT ["/entrypoint.sh"]
