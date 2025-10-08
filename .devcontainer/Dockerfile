FROM node:20.17.0-slim AS base

ENV DEBIAN_FRONTEND=noninteractive
ENV NX_VERSION=19.6.2
ENV NX_SOCKET_DIR="/tmp/nx"
ENV BUILD_PACKAGES="make cmake g++ git python3 curl ca-certificates libboost-all-dev wget lsb-release software-properties-common gnupg"
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

WORKDIR /workspaces/openpra-monorepo
SHELL ["/bin/bash", "-c"]
RUN --mount=target=/var/lib/apt/lists,type=cache,sharing=locked \
    --mount=target=/var/cache/apt,type=cache,sharing=locked \
    rm -f /etc/apt/apt.conf.d/docker-clean && \
    apt update && \
    apt install -y --no-install-recommends $BUILD_PACKAGES $SCRAM_BUILD_PACKAGES $SCRAM_RUNTIME_PACKAGES && \
    update-ca-certificates && \
    wget https://apt.llvm.org/llvm.sh && \
    chmod +x llvm.sh && \
    ./llvm.sh $CLANG_VERSION && \
    apt update && \
    apt install -y --no-install-recommends $LLVM_PACKAGES && \
    git clone https://github.com/AdaptiveCpp/AdaptiveCpp && \
    mkdir AdaptiveCpp/build && cd AdaptiveCpp/build && \
    cmake -DCMAKE_BUILD_TYPE=Release \
          -DCMAKE_INSTALL_PREFIX=/usr/local \
          -DCMAKE_C_COMPILER=/usr/bin/clang-$CLANG_VERSION \
          -DCMAKE_CXX_COMPILER=/usr/bin/clang++-$CLANG_VERSION \
          -DCLANG_EXECUTABLE_PATH=/usr/bin/clang++-$CLANG_VERSION \
          -DLLVM_DIR=/usr/lib/llvm-$CLANG_VERSION/cmake \
          -DWITH_CUDA_BACKEND=OFF \
          -DWITH_ROCM_BACKEND=OFF \
          -DWITH_LEVEL_ZERO_BACKEND=OFF \
          -DWITH_OPENCL_BACKEND=OFF \
          -DACPP_USE_ACCELERATED_CPU=ON \
          -DACPP_COMPILER_FEATURE_PROFILE="full" .. && \
    make -j && \
    make install && \
    cd ../.. && \
    rm -rf AdaptiveCpp && \
    npm install --global pnpm nx@$NX_VERSION && \
    SHELL=bash pnpm setup

COPY . .
RUN source /root/.bashrc && \
    git submodule update --init --recursive

FROM base AS serve
COPY .devcontainer/entrypoint.sh /
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]