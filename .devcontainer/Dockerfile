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
RUN --mount=target=/var/lib/apt/lists,type=cache,sharing=locked \
    --mount=target=/var/cache/apt,type=cache,sharing=locked \
    rm -f /etc/apt/apt.conf.d/docker-clean && \
    apt update && \
    apt install -y --no-install-recommends $BUILD_PACKAGES $SCRAM_BUILD_PACKAGES $SCRAM_RUNTIME_PACKAGES \
    # Install MongoDB
    && curl -fsSL https://pgp.mongodb.com/server-6.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-6.0.gpg \
    && echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-6.0.gpg ] https://repo.mongodb.org/apt/debian bullseye/mongodb-org/6.0 main" | tee /etc/apt/sources.list.d/mongodb-org-6.0.list \
    && apt update && apt install -y mongodb-org \
    # Install RabbitMQ and Erlang
    && curl -fsSL https://packages.erlang-solutions.com/ubuntu/erlang_solutions.asc | gpg --dearmor -o /usr/share/keyrings/erlang.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/erlang.gpg] https://packages.erlang-solutions.com/ubuntu $(lsb_release -cs) contrib" | tee /etc/apt/sources.list.d/erlang.list \
    && apt update && apt install -y erlang-nox \
    && curl -fsSL https://packagecloud.io/rabbitmq/rabbitmq-server/gpgkey | gpg --dearmor -o /usr/share/keyrings/rabbitmq.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/rabbitmq.gpg] https://packagecloud.io/rabbitmq/rabbitmq-server/debian/ bullseye main" | tee /etc/apt/sources.list.d/rabbitmq.list \
    && apt update && apt install -y rabbitmq-server \
    # Clean up
    && apt clean && rm -rf /var/lib/apt/lists/*

# Install Node.js global tools
RUN npm install --global pnpm nx@$NX_VERSION && SHELL=bash pnpm setup

COPY . .

RUN source /root/.bashrc && git submodule update --init --recursive

COPY entrypoint.sh /
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]