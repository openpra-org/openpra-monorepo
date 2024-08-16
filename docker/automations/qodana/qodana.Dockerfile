FROM jetbrains/qodana-js:latest as BASE

ENV DEBIAN_FRONTEND=noninteractive
ENV NX_VERSION=17.1.2
ENV BUILD_PACKAGES \
    make cmake g++ python3

ENV SCRAM_BUILD_PACKAGES \
    libxml2-dev libomp-dev \
    libgoogle-perftools-dev libboost-program-options-dev \
    libboost-math-dev libboost-random-dev libboost-filesystem-dev \
    libboost-test-dev libboost-date-time-dev libjemalloc-dev

ENV SCRAM_RUNTIME_PACKAGES \
    libxml2 libboost-filesystem1.74.0 libboost-program-options1.74.0 \
    libtcmalloc-minimal4 libjemalloc2

SHELL ["/bin/bash", "-c"]
RUN --mount=target=/var/lib/apt/lists,type=cache,sharing=locked \
    --mount=target=/var/cache/apt,type=cache,sharing=locked \
    rm -f /etc/apt/apt.conf.d/docker-clean && \
    apt update && \
    apt install -y --no-install-recommends $BUILD_PACKAGES $SCRAM_BUILD_PACKAGES $SCRAM_RUNTIME_PACKAGES && \
    npm install --global nx@$NX_VERSION

WORKDIR /data/project
COPY ../../.. .

RUN SHELL=bash pnpm setup && \
    source /root/.bashrc && \
    pnpm install

COPY qodana-entrypoint.sh /docker-entrypoint.d/
RUN chmod +x /docker-entrypoint.d/qodana-entrypoint.sh
ENTRYPOINT ["/bin/bash", "/docker-entrypoint.d/qodana-entrypoint.sh"]
