#syntax=docker/dockerfile:1
FROM node:20.9.0-slim AS base

ENV DEBIAN_FRONTEND=noninteractive
ENV NX_VERSION=17.1.2

ENV BUILD_PACKAGES="apt-transport-https \
    ca-certificates \
    curl \
    git \
    golang \
    gnupg \
    jq \
    locales \
    nano \
    python3 \
    ssh \
    sudo \
    wget"

ENV SCRAM_BUILD_PACKAGES="cmake \
    doxygen \
    g++ \
    graphviz \
    libboost-date-time-dev \
    libboost-filesystem-dev \
    libboost-math-dev \
    libboost-program-options-dev \
    libboost-random-dev \
    libboost-test-dev \
    libgoogle-perftools-dev \
    libjemalloc-dev \
    libomp-dev \
    libxml2-dev \
    make"

ENV SCRAM_RUNTIME_PACKAGES="libxml2 \
    libboost-filesystem1.74.0 \
    libboost-program-options1.74.0 \
    libtcmalloc-minimal4 \
    libjemalloc2"

ENV DEBUGGER_PACKAGES="gdb valgrind"

ENV MONGODB_PACKAGES="mongodb-org"

ENV RABBITMQ_PACKAGES="erlang-base \
    erlang-asn1 erlang-crypto erlang-eldap erlang-ftp erlang-inets \
    erlang-mnesia erlang-os-mon erlang-parsetools erlang-public-key \
    erlang-runtime-tools erlang-snmp erlang-ssl \
    erlang-syntax-tools erlang-tftp erlang-tools erlang-xmerl \
    rabbitmq-server"

## Install the build packages
SHELL ["/bin/bash", "-c"]
RUN --mount=target=/var/lib/apt/lists,type=cache,sharing=locked \
    --mount=target=/var/cache/apt,type=cache,sharing=locked \
    rm -f /etc/apt/apt.conf.d/docker-clean && \
    apt update && \
    apt install -y --no-install-recommends $BUILD_PACKAGES && \
    update-ca-certificates && \
    sed -i -e 's/# en_US.UTF-8 UTF-8/en_US.UTF-8 UTF-8/' /etc/locale.gen && \
    dpkg-reconfigure --frontend=noninteractive locales && \
    update-locale LANG=en_US.UTF-8
ENV LANG=en_US.UTF-8

## Handle RabbitMQ sources
ENV RABBITMQ_KEY="https://keys.openpgp.org/vks/v1/by-fingerprint/0A9AF2115F4687BD29803A206B73A36E6026DFCA"
ENV REPO_ERLANG="https://github.com/rabbitmq/signing-keys/releases/download/3.0/cloudsmith.rabbitmq-erlang.E495BB49CC4BBE5B.key"
ENV REPO_RABBITMQ="https://github.com/rabbitmq/signing-keys/releases/download/3.0/cloudsmith.rabbitmq-server.9F4587F226208342.key"
ENV REPO_MONGODB="https://pgp.mongodb.com/server-6.0.asc"
COPY rabbitmq-sources.list /etc/apt/sources.list.d/rabbitmq.list
COPY mongodb-org-sources.list /etc/apt/sources.list.d/mongodb-org-6.0.list

WORKDIR /app
SHELL ["/bin/bash", "-c"]
RUN --mount=target=/var/lib/apt/lists,type=cache,sharing=locked \
    --mount=target=/var/cache/apt,type=cache,sharing=locked \
    rm -f /etc/apt/apt.conf.d/docker-clean && \
    curl -1sLf "$RABBITMQ_KEY" | gpg --dearmor -o /usr/share/keyrings/com.rabbitmq.team.gpg && \
    curl -1sLf "$REPO_ERLANG" | gpg --dearmor -o /usr/share/keyrings/rabbitmq.E495BB49CC4BBE5B.gpg && \
    curl -1sLf "$REPO_RABBITMQ" | gpg --dearmor -o /usr/share/keyrings/rabbitmq.9F4587F226208342.gpg && \
    curl -fsSL "$REPO_MONGODB" | gpg --dearmor -o /usr/share/keyrings/mongodb-server-6.0.gpg && \
    ## mongo dependency
    wget https://security.debian.org/debian-security/pool/updates/main/o/openssl/libssl1.1_1.1.1n-0+deb11u5_amd64.deb && \
    dpkg -i libssl1.1_1.1.1n-0+deb11u5_amd64.deb && \
    apt update && \
    apt install -y --no-install-recommends $SCRAM_BUILD_PACKAGES $SCRAM_RUNTIME_PACKAGES $DEBUGGER_PACKAGES $RABBITMQ_PACKAGES $MONGODB_PACKAGES && \
    npm install --global pnpm nx@$NX_VERSION && \
    SHELL=bash pnpm setup && \
    mkdir -p /data/db

COPY coder-permissions.sh /usr/bin/coder-set-file-permissions
COPY coder-git-clone.sh /usr/bin/coder-git-clone
COPY coder-mongodb.sh /usr/bin/coder-mongo-daemon
COPY coder-rabbitmq-server.sh /usr/bin/coder-rabbitmq-server

ARG USER=coder
ARG UID=1000
ARG GID=1000
RUN if getent passwd ${UID}; then userdel -f $(getent passwd ${UID} | cut -d: -f1); fi && \
    if getent group ${GID}; then groupdel $(getent group ${GID} | cut -d: -f1); fi && \
    groupadd -g ${GID} ${USER} && \
    useradd --uid ${UID} --gid ${GID} --groups sudo --create-home --shell /bin/bash ${USER} && \
    echo "${USER} ALL=(ALL) NOPASSWD:ALL" >/etc/sudoers.d/${USER} && \
    chmod 0440 /etc/sudoers.d/${USER} && \
    sudo touch /tmp/rabbitmq-server.log && \
    sudo chmod 0666 /tmp/rabbitmq-server.log && \
    mkdir -p /home/${USER}/projects && \
    chown -R ${USER}:${USER} /home/${USER} && \
    chmod +x /usr/bin/coder-set-file-permissions \
             /usr/bin/coder-mongo-daemon \
             /usr/bin/coder-git-clone \
             /usr/bin/coder-rabbitmq-server

USER ${USER}
WORKDIR /home/${USER}/projects
