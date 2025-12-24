FROM node:20-slim AS base

ENV DEBIAN_FRONTEND=noninteractive
ENV BUILD_PACKAGES="make cmake g++ git python3 curl ca-certificates libboost-all-dev wget lsb-release software-properties-common gnupg xauth"
ENV CLANG_VERSION=18
ENV LLVM_PACKAGES="libclang-18-dev clang-tools-18 libomp-18-dev llvm-18-dev lld-18"

ENV SCRAM_BUILD_PACKAGES="libxml2-dev libomp-dev \
    libxml2-dev libomp-dev \
    libgoogle-perftools-dev libboost-program-options-dev \
    libboost-math-dev libboost-random-dev libboost-filesystem-dev \
    libboost-test-dev libboost-date-time-dev libjemalloc-dev"

ENV SCRAM_RUNTIME_PACKAGES="libxml2 \
    libboost-filesystem1.74.0 libboost-program-options1.74.0 \
    libtcmalloc-minimal4 libjemalloc2"

ENV PATH="/root/.local/bin:${PATH}"

WORKDIR /workspaces/microservices
SHELL ["/bin/bash", "-c"]
RUN --mount=target=/var/lib/apt/lists,type=cache,sharing=locked \
    --mount=target=/var/cache/apt,type=cache,sharing=locked \
    rm -f /etc/apt/apt.conf.d/docker-clean && \
    apt update && \
    apt install -y --no-install-recommends $BUILD_PACKAGES $SCRAM_BUILD_PACKAGES $SCRAM_RUNTIME_PACKAGES && \
    update-ca-certificates && \
    # Manual LLVM setup with retries to handle network flakes
    wget -qO- https://apt.llvm.org/llvm-snapshot.gpg.key | tee /etc/apt/trusted.gpg.d/apt.llvm.org.asc && \
    add-apt-repository -y "deb http://apt.llvm.org/bookworm/ llvm-toolchain-bookworm-$CLANG_VERSION main" && \
    apt update && \
    # Retry loop for apt install
    (for i in {1..5}; do apt install -y --no-install-recommends $LLVM_PACKAGES && break || sleep 15; done) && \
    npm install -g pnpm

COPY . .

FROM base AS serve
COPY .devcontainer/entrypoint.sh /
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
