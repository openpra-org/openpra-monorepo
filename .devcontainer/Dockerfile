FROM node:20.17.0-bullseye-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV NX_VERSION=19.6.2
ENV NX_SOCKET_DIR="/tmp/nx"
ENV BUILD_PACKAGES="make cmake g++ git python3 curl ca-certificates gnupg lsb-release"
ENV SCRAM_BUILD_PACKAGES="libxml2-dev libomp-dev libgoogle-perftools-dev libboost-program-options-dev libboost-math-dev libboost-random-dev libboost-filesystem-dev libboost-test-dev libboost-date-time-dev libjemalloc-dev"
ENV SCRAM_RUNTIME_PACKAGES="libxml2 libboost-filesystem1.74.0 libboost-program-options1.74.0 libtcmalloc-minimal4 libjemalloc2"
ENV PATH="/root/.local/bin:${PATH}"

WORKDIR /workspaces/openpra-monorepo
SHELL ["/bin/bash", "-c"]

# Install system dependencies, MongoDB, and RabbitMQ
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        $BUILD_PACKAGES \
        $SCRAM_BUILD_PACKAGES \
        $SCRAM_RUNTIME_PACKAGES

# Install MongoDB
RUN curl -fsSL https://pgp.mongodb.com/server-6.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-6.0.gpg && \
    echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-6.0.gpg ] https://repo.mongodb.org/apt/debian bullseye/mongodb-org/6.0 main" > /etc/apt/sources.list.d/mongodb-org-6.0.list && \
    apt-get update && \
    apt-get install -y mongodb-org

# Install Erlang (required for RabbitMQ)
RUN curl -fsSL https://packages.erlang-solutions.com/ubuntu/erlang_solutions.asc | gpg --dearmor -o /usr/share/keyrings/erlang.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/erlang.gpg] https://packages.erlang-solutions.com/ubuntu $(lsb_release -cs) contrib" > /etc/apt/sources.list.d/erlang.list && \
    apt-get update && \
    apt-get install -y erlang-nox

# Install RabbitMQ
RUN curl -fsSL https://packagecloud.io/rabbitmq/rabbitmq-server/gpgkey | gpg --dearmor -o /usr/share/keyrings/rabbitmq-archive-keyring.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/rabbitmq-archive-keyring.gpg] https://packagecloud.io/rabbitmq/rabbitmq-server/debian/ bullseye main" > /etc/apt/sources.list.d/rabbitmq.list && \
    apt-get update && \
    apt-get install -y rabbitmq-server

# Clean up
RUN apt-get clean && rm -rf /var/lib/apt/lists/*

# Create MongoDB data directory
RUN mkdir -p /data/db && chown -R mongodb:mongodb /data/db

# Install Node.js global tools
RUN npm install --global pnpm nx@$NX_VERSION && pnpm setup

# Copy source code
COPY . .

# Initialize git submodules
RUN source /root/.bashrc && git submodule update --init --recursive

# Copy entrypoint script
COPY entrypoint.sh /
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]