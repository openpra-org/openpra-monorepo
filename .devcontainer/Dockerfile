# syntax=docker/dockerfile:1.4
FROM mcr.microsoft.com/devcontainers/typescript-node:20-bookworm

ENV DEBIAN_FRONTEND=noninteractive
ENV NX_VERSION=19.6.2
ENV PNPM_HOME="/home/node/.local/share/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# Install build tools and libraries for C++/Node/MongoDB/RabbitMQ
RUN apt-get update && apt-get install -y --no-install-recommends \
    make cmake ninja-build g++ doxygen graphviz \
    libboost-date-time-dev libboost-filesystem-dev libboost-math-dev \
    libboost-program-options-dev libboost-random-dev libboost-test-dev \
    libgoogle-perftools-dev libjemalloc-dev libomp-dev libxml2-dev \
    gdb valgrind \
    libxml2 libboost-filesystem1.74.0 libboost-program-options1.74.0 \
    libtcmalloc-minimal4 libjemalloc2 \
    python3 python3-pip git curl jq locales nano sudo wget \
    && rm -rf /var/lib/apt/lists/*

# Set up locales
RUN sed -i -e 's/# en_US.UTF-8 UTF-8/en_US.UTF-8 UTF-8/' /etc/locale.gen && \
    dpkg-reconfigure --frontend=noninteractive locales && \
    update-locale LANG=en_US.UTF-8
ENV LANG=en_US.UTF-8

# Install pnpm and nx globally
RUN npm install -g pnpm nx@$NX_VERSION

# Set up npm cache for speed and permissions
RUN mkdir -p /vscode-dev/npm-cache && chown node:node /vscode-dev/npm-cache

USER node
WORKDIR /workspaces/openpra-monorepo

# Set up npm cache symlink for node user
RUN NPM_CACHE="$(npm config get cache)" && rm -rf "$NPM_CACHE" && ln -s /vscode-dev/npm-cache "$NPM_CACHE"
RUN echo 'export DISPLAY="${DISPLAY:-:1}"' | tee -a ~/.bashrc >> ~/.zshrc

CMD sleep inf