FROM node:20-bookworm-slim AS base

ENV DEBIAN_FRONTEND=noninteractive
ENV NX_VERSION=19.6.2
ENV NX_SOCKET_DIR="/tmp/nx"
ENV BUILD_PACKAGES="make cmake g++ git python3 curl ca-certificates"
ENV SCRAM_BUILD_PACKAGES="libxml2-dev libomp-dev libgoogle-perftools-dev libboost-program-options-dev libboost-math-dev libboost-random-dev libboost-filesystem-dev libboost-test-dev libboost-date-time-dev libjemalloc-dev"
ENV SCRAM_RUNTIME_PACKAGES="libxml2 libboost-filesystem1.74.0 libboost-program-options1.74.0 libtcmalloc-minimal4 libjemalloc2"
ENV ADAPTIVECPP_BUILD_PACKAGES="clang-18 llvm-18-dev libclang-18-dev libomp-18-dev lld-18"
ENV PATH="/root/.local/bin:${PATH}"

WORKDIR /workspaces/openpra-monorepo
SHELL ["/bin/bash", "-c"]
RUN --mount=target=/var/lib/apt/lists,type=cache,sharing=locked \
    --mount=target=/var/cache/apt,type=cache,sharing=locked \
    rm -f /etc/apt/apt.conf.d/docker-clean && \
    apt update && \
    apt install -y curl ca-certificates gnupg && \
    # Install LLVM/Clang 18 repository
    curl -o llvm.sh https://apt.llvm.org/llvm.sh && \
    chmod +x llvm.sh && \
    ./llvm.sh 18 && \
    apt update && \
    apt install -y --no-install-recommends $BUILD_PACKAGES $SCRAM_BUILD_PACKAGES $SCRAM_RUNTIME_PACKAGES $ADAPTIVECPP_BUILD_PACKAGES && \
    update-ca-certificates && \
    npm install --global pnpm nx@$NX_VERSION && \
    SHELL=bash pnpm setup

COPY . .
RUN source /root/.bashrc && \
    git submodule update --init --recursive && \
    # Install AdaptiveCpp for CPU-only Monte Carlo simulation
    git clone https://github.com/AdaptiveCpp/AdaptiveCpp.git /tmp/AdaptiveCpp && \
    mkdir -p /tmp/AdaptiveCpp/build && \
    cd /tmp/AdaptiveCpp/build && \
    cmake -DCMAKE_BUILD_TYPE=Release \
          -DCMAKE_INSTALL_PREFIX=/usr/local \
          -DCMAKE_C_COMPILER=/usr/bin/clang-18 \
          -DCMAKE_CXX_COMPILER=/usr/bin/clang++-18 \
          -DLLVM_DIR=/usr/lib/llvm-18/cmake \
          -DACPP_TARGETS="omp" \
          .. && \
    make -j$(nproc) && \
    make install && \
    ldconfig && \
    rm -rf /tmp/AdaptiveCpp

FROM base AS serve
COPY .devcontainer/entrypoint.sh /
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]