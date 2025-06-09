FROM mcr.microsoft.com/devcontainers/javascript-node:20

# Add MongoDB GPG key and repository
RUN curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | \
    gpg --dearmor -o /usr/share/keyrings/mongodb-server-8.0.gpg && \
    echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/8.0 multiverse" \
    | tee /etc/apt/sources.list.d/mongodb-org-8.0.list

# Install system dependencies, build tools, MongoDB, and RabbitMQ
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    make cmake ninja-build g++ \
    libboost-date-time-dev libboost-filesystem-dev libboost-math-dev \
    libboost-program-options-dev libboost-random-dev libboost-test-dev \
    libgoogle-perftools-dev libjemalloc-dev libomp-dev libxml2-dev \
    gdb valgrind \
    libxml2 libboost-filesystem1.74.0 libboost-program-options1.74.0 \
    libtcmalloc-minimal4 libjemalloc2 \
    python3 python3-pip git curl jq locales nano sudo wget \
    rabbitmq-server \
    mongodb-org \
    && rm -rf /var/lib/apt/lists/*

# Set up locale
RUN sed -i -e 's/# en_US.UTF-8 UTF-8/en_US.UTF-8 UTF-8/' /etc/locale.gen && \
    locale-gen
ENV LANG=en_US.UTF-8

# Install pnpm and nx globally
RUN npm install -g pnpm nx@19.6.2

# Set up npm cache for speed and permissions
RUN mkdir -p /vscode-dev/npm-cache && chown vscode:vscode /vscode-dev/npm-cache

# Copy the devcontainer-setup.sh script and make it executable
COPY .devcontainer/devcontainer-setup.sh /usr/local/bin/devcontainer-setup.sh
RUN chmod +x /usr/local/bin/devcontainer-setup.sh

USER vscode
WORKDIR /workspaces/openpra-monorepo

# Set up npm cache symlink for node user
RUN NPM_CACHE="$(npm config get cache)" && rm -rf "$NPM_CACHE" && ln -s /vscode-dev/npm-cache "$NPM_CACHE"
RUN echo 'export DISPLAY="${DISPLAY:-:1}"' | tee -a ~/.bashrc >> ~/.zshrc

CMD sleep inf