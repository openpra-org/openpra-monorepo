FROM mcr.microsoft.com/devcontainers/base:ubuntu-22.04

ARG REPO_NAME

# Add MongoDB GPG key and repository
RUN curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | \
    gpg --dearmor -o /usr/share/keyrings/mongodb-server-8.0.gpg && \
    echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/8.0 multiverse" \
    | tee /etc/apt/sources.list.d/mongodb-org-8.0.list

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

# Set up user
RUN usermod -aG sudo vscode

WORKDIR /workspaces/${REPO_NAME}

# Copy entrypoint scripts if needed
COPY devcontainer-setup.sh /usr/local/bin/devcontainer-setup.sh
RUN chmod +x /usr/local/bin/devcontainer-setup.sh