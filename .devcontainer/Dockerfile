FROM mcr.microsoft.com/devcontainers/base:ubuntu-22.04

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      make cmake g++ git curl ca-certificates \
      libxml2-dev libomp-dev \
      libgoogle-perftools-dev libboost-program-options-dev \
      libboost-math-dev libboost-random-dev libboost-filesystem-dev \
      libboost-test-dev libboost-date-time-dev libjemalloc-dev \
      libxml2 libboost-filesystem1.74.0 libboost-program-options1.74.0 \
      libtcmalloc-minimal4 libjemalloc2 \
      gdb valgrind \
      python3 python3-pip \
      wget gnupg \
      sudo locales \
      nano \
      rabbitmq-server \
      mongodb-org \
    && rm -rf /var/lib/apt/lists/*

# Set up locale
RUN sed -i -e 's/# en_US.UTF-8 UTF-8/en_US.UTF-8 UTF-8/' /etc/locale.gen && \
    locale-gen

# Install Node, pnpm, nx
RUN npm install -g pnpm nx@19.6.2

# Set up MongoDB and RabbitMQ (run as services in postCreateCommand)
# (No need to start them here)

# Set up user
RUN usermod -aG sudo vscode

WORKDIR /workspaces/${GITHUB_REPOSITORY##*/}

# Copy entrypoint scripts if needed
COPY devcontainer-setup.sh /usr/local/bin/devcontainer-setup.sh
RUN chmod +x /usr/local/bin/devcontainer-setup.sh