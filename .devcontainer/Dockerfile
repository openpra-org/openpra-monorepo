# syntax=docker/dockerfile:1.4
FROM mcr.microsoft.com/devcontainers/typescript-node:20-bookworm

# Install system build dependencies and C++/Python tools
ENV DEBIAN_FRONTEND=noninteractive
ENV NX_VERSION=19.6.2
ENV PNPM_HOME="/home/node/.local/share/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# Install build tools and libraries for C++/Node/MongoDB/RabbitMQ
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      apt-transport-https ca-certificates curl git \
      golang gnupg jq locales nano python3 python3-pip ssh sudo wget \
      make cmake g++ doxygen graphviz \
      libboost-date-time-dev libboost-filesystem-dev libboost-math-dev \
      libboost-program-options-dev libboost-random-dev libboost-test-dev \
      libgoogle-perftools-dev libjemalloc-dev libomp-dev libxml2-dev \
      gdb valgrind \
      libxml2 libboost-filesystem1.74.0 libboost-program-options1.74.0 \
      libtcmalloc-minimal4 libjemalloc2 \
      && rm -rf /var/lib/apt/lists/*

# Set up locales
RUN sed -i -e 's/# en_US.UTF-8 UTF-8/en_US.UTF-8 UTF-8/' /etc/locale.gen && \
    dpkg-reconfigure --frontend=noninteractive locales && \
    update-locale LANG=en_US.UTF-8
ENV LANG=en_US.UTF-8

# Install pnpm and nx globally
RUN npm install -g pnpm nx@$NX_VERSION

# DO NOT install node-gyp (cmake-js is used instead)

# Add VS Code (optional, for desktop-lite feature)
ADD install-vscode.sh /root/
RUN /root/install-vscode.sh

# Set up npm cache for speed
USER node
RUN NPM_CACHE="$(npm config get cache)" && rm -rf "$NPM_CACHE" && ln -s /vscode-dev/npm-cache "$NPM_CACHE"
RUN echo 'export DISPLAY="${DISPLAY:-:1}"' | tee -a ~/.bashrc >> ~/.zshrc

USER root
CMD chown node:node /vscode-dev && sudo -u node mkdir -p /vscode-dev/npm-cache && sleep inf