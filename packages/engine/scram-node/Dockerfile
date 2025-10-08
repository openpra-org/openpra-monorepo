# syntax=docker/dockerfile:1.10.0
FROM nvidia/cuda:12.6.3-cudnn-devel-ubuntu24.04 AS base

ENV CODENAME="noble"
ENV DEBIAN_FRONTEND=noninteractive

## install apt-fast for faster downloads
RUN --mount=target=/var/lib/apt/lists,type=cache,sharing=locked \
    --mount=target=/var/cache/apt,type=cache,sharing=locked \
    rm -f /etc/apt/apt.conf.d/docker-clean && \
    apt update && \
    apt install -y --no-install-recommends software-properties-common && \
    add-apt-repository -y ppa:apt-fast/stable && \
    apt install -y --no-install-recommends apt-fast && \
    apt-fast upgrade -y --no-install-recommends && \
    apt-fast -y autoremove

ENV BUILD_PACKAGES="ca-certificates \
    curl \
    file \
    git \
    golang \
    gnupg \
    jq \
    lsb-release \
    nano \
    python3 \
    rsync \
    ssh \
    sudo \
    unzip \
    wget"

ENV SRC_BUILD_PACKAGES="automake \
    cmake \
    doxygen \
    doxygen-doc \
    graphviz \
    libboost-all-dev \
    libcln-dev \
    libcurl4-openssl-dev \
    libedit-dev \
    libeigen3-dev \
    libgmp-dev \
    libginac-dev \
    libglpk-dev \
    libhwloc-dev \
    libnuma-dev \
    libxerces-c-dev \
    libz3-dev \
    libzstd-dev \
    spirv-cross \
    spirv-headers \
    spirv-tools"

ENV SCRAM_BUILD_PACKAGES="cmake \
    doxygen \
    g++ \
    graphviz \
    libgoogle-perftools-dev \
    libjemalloc-dev \
    libomp-dev \
    libxml2-dev \
    make"

ENV SCRAM_RUNTIME_PACKAGES="libxml2 \
    libtcmalloc-minimal4 \
    libjemalloc2"

ENV DEBUGGER_PACKAGES="gdb \
    valgrind \
    linux-tools-generic \
    systemtap-sdt-dev \
    gdbserver \
    ccache \
    python3"

# Optional, device monitoring
ENV UTIL_PACKAGES="htop nvtop intel-gpu-tools"

ENV OPENCL_PACKAGES="ocl-icd-libopencl1 opencl-headers clinfo"
## Install Nvidia GPUs as OpenCL target as well
FROM base AS minimal
WORKDIR /etc/OpenCL/vendors
COPY <<EOF /etc/OpenCL/vendors/nvidia.icd
libnvidia-opencl.so.1
EOF

RUN --mount=target=/var/lib/apt/lists,type=cache,sharing=locked \
    --mount=target=/var/cache/apt,type=cache,sharing=locked \
    rm -f /etc/apt/apt.conf.d/docker-clean && \
    apt-fast install -y --no-install-recommends \
    $BUILD_PACKAGES \
    $SRC_BUILD_PACKAGES \
    $DEBUGGER_PACKAGES \
    $UTIL_PACKAGES \
    $OPENCL_PACKAGES \
    $SCRAM_BUILD_PACKAGES \
    $SCRAM_RUNTIME_PACKAGES && \
    update-ca-certificates

## Install llvm/clang
FROM minimal AS llvm-clang
WORKDIR /build
ENV CLANG_VERSION="18"
ENV LLVM_PACKAGES="libclang-$CLANG_VERSION-dev \
    clang-tools-$CLANG_VERSION \
    libomp-$CLANG_VERSION-dev \
    llvm-$CLANG_VERSION-dev \
    lld-$CLANG_VERSION"
RUN --mount=target=/var/lib/apt/lists,type=cache,sharing=locked \
    --mount=target=/var/cache/apt,type=cache,sharing=locked \
    rm -f /etc/apt/apt.conf.d/docker-clean && \
    wget https://apt.llvm.org/llvm.sh && \
    chmod +x llvm.sh && \
    ./llvm.sh $CLANG_VERSION && \
    apt-fast update && \
    apt-fast install -y --no-install-recommends $LLVM_PACKAGES

## Install Intel OneAPI OpenCL
FROM llvm-clang AS oneapi-clang
ENV INTEL_ONEAPI_OPENCL_PACKAGES="intel-oneapi-runtime-opencl-2024 intel-oneapi-runtime-compilers-2024 ocl-icd-libopencl1 ocl-icd-opencl-dev"
ENV INTEL_ONEAPI_MKL_PACKAGES="intel-oneapi-mkl intel-oneapi-mkl-devel"
RUN --mount=target=/var/lib/apt/lists,type=cache,sharing=locked \
    --mount=target=/var/cache/apt,type=cache,sharing=locked \
    rm -f /etc/apt/apt.conf.d/docker-clean && \
    wget -O- https://apt.repos.intel.com/intel-gpg-keys/GPG-PUB-KEY-INTEL-SW-PRODUCTS.PUB | gpg --dearmor | tee /usr/share/keyrings/oneapi-archive-keyring.gpg > /dev/null && \
    echo "deb [signed-by=/usr/share/keyrings/oneapi-archive-keyring.gpg] https://apt.repos.intel.com/oneapi all main" | tee /etc/apt/sources.list.d/oneAPI.list && \
    apt-fast update && \
    apt-fast install -y --no-install-recommends $INTEL_ONEAPI_OPENCL_PACKAGES $INTEL_ONEAPI_MKL_PACKAGES

## Download Intel Level Zero & Compute Runtime
FROM hobbsau/aria2 AS intel-lz-debs
WORKDIR /build/intel-lz
COPY <<EOF /build/intel-lz/intel-lz-debs.list
https://github.com/intel/intel-graphics-compiler/releases/download/igc-1.0.17537.20/intel-igc-core_1.0.17537.20_amd64.deb
https://github.com/intel/intel-graphics-compiler/releases/download/igc-1.0.17537.20/intel-igc-opencl_1.0.17537.20_amd64.deb
https://github.com/intel/compute-runtime/releases/download/24.35.30872.22/intel-level-zero-gpu-dbgsym_1.3.30872.22_amd64.ddeb
https://github.com/intel/compute-runtime/releases/download/24.35.30872.22/intel-level-zero-gpu-legacy1-dbgsym_1.3.30872.22_amd64.ddeb
https://github.com/intel/compute-runtime/releases/download/24.35.30872.22/intel-level-zero-gpu-legacy1_1.3.30872.22_amd64.deb
https://github.com/intel/compute-runtime/releases/download/24.35.30872.22/intel-level-zero-gpu_1.3.30872.22_amd64.deb
https://github.com/intel/compute-runtime/releases/download/24.35.30872.22/intel-opencl-icd-dbgsym_24.35.30872.22_amd64.ddeb
https://github.com/intel/compute-runtime/releases/download/24.35.30872.22/intel-opencl-icd-legacy1-dbgsym_24.35.30872.22_amd64.ddeb
https://github.com/intel/compute-runtime/releases/download/24.35.30872.22/intel-opencl-icd-legacy1_24.35.30872.22_amd64.deb
https://github.com/intel/compute-runtime/releases/download/24.35.30872.22/intel-opencl-icd_24.35.30872.22_amd64.deb
https://github.com/intel/compute-runtime/releases/download/24.35.30872.22/libigdgmm12_22.5.0_amd64.deb
EOF
RUN aria2c -j32 -k 1M -i intel-lz-debs.list -d debs

## Compile & Install Intel OneAPI Level Zero for Intel GPU support
FROM oneapi-clang AS lz-oneapi-clang
WORKDIR /build/intel-lz
COPY --from=intel-lz-debs /build/intel-lz/debs /build/intel-lz/debs
ARG CMAKE_BUILD_TYPE="Release"
ENV CMAKE_C_COMPILER="/usr/bin/clang-$CLANG_VERSION"
ENV CC="$CMAKE_C_COMPILER"
ENV CMAKE_CXX_COMPILER="/usr/bin/clang++-$CLANG_VERSION"
ENV CXX="$CMAKE_CXX_COMPILER"
RUN --mount=target=/var/lib/apt/lists,type=cache,sharing=locked \
    --mount=target=/var/cache/apt,type=cache,sharing=locked \
    dpkg -i /build/intel-lz/debs/*.deb && \
    git clone https://github.com/oneapi-src/level-zero.git && \
    mkdir -p level-zero/build && cd level-zero/build && \
    cmake -DCMAKE_BUILD_TYPE=Release .. && \
    cmake --build . -j --target package && \
    cmake --build . -j --target install

## Download Intel Level Zero & Compute Runtime
FROM hobbsau/aria2 AS amdgpu-debs
WORKDIR /build/amdgpu
COPY <<EOF /build/amdgpu/amdgpu-debs.list
https://repo.radeon.com/amdgpu-install/6.4.1/ubuntu/noble/amdgpu-install_6.4.60401-1_all.deb
EOF
RUN aria2c -j8 -k 1M -i amdgpu-debs.list -d debs

## Install AMD GPU Driver, OpenCL & ROCm backends
FROM lz-oneapi-clang AS amd-lz-oneapi-clang
WORKDIR /build/amdgpu
COPY --from=amdgpu-debs /build/amdgpu/debs /build/amdgpu/debs
ARG ROCM_PACKAGES="rocm-dev"
RUN --mount=target=/var/lib/apt/lists,type=cache,sharing=locked \
    --mount=target=/var/cache/apt,type=cache,sharing=locked \
    rm -f /etc/apt/apt.conf.d/docker-clean && \
    dpkg -i /build/amdgpu/debs/*.deb && \
    amdgpu-install --usecase=opencl,graphics --opencl=rocr --vulkan=pro,amdvlk --no-dkms --accept-eula -y && \
    mkdir -p /etc/OpenCL/vendors && \
    echo "libamdocl64.so" > /etc/OpenCL/vendors/amdocl64.icd && \
    ln -s /usr/lib/x86_64-linux-gnu/libOpenCL.so.1 /usr/lib/libOpenCL.so && \
    apt-fast update && \
    apt-fast install -y --no-install-recommends $ROCM_PACKAGES

## Install AdaptiveCpp
WORKDIR /build
FROM amd-lz-oneapi-clang AS adaptivecpp-amd-lz-oneapi-clang
ENV ADAPTIVE_CPP_INSTALL_DIR="/usr/local"
ENV CLANG_EXECUTABLE_PATH="/usr/bin/clang++-$CLANG_VERSION"
ENV LLVM_DIR="/usr/lib/llvm-$CLANG_VERSION/cmake"
RUN --mount=target=/var/lib/apt/lists,type=cache,sharing=locked \
    --mount=target=/var/cache/apt,type=cache,sharing=locked \
    rm -f /etc/apt/apt.conf.d/docker-clean && \
    git clone https://github.com/AdaptiveCpp/AdaptiveCpp && \
    mkdir -p AdaptiveCpp/build && cd AdaptiveCpp/build && \
    cmake -DCMAKE_BUILD_TYPE=$CMAKE_BUILD_TYPE \
          -DCMAKE_INSTALL_PREFIX=$ADAPTIVE_CPP_INSTALL_DIR \
          -DCMAKE_C_COMPILER=$CMAKE_C_COMPILER \
          -DCMAKE_CXX_COMPILER=$CMAKE_CXX_COMPILER \
          -DCLANG_EXECUTABLE_PATH=$CLANG_EXECUTABLE_PATH \
          -DLLVM_DIR=$LLVM_DIR \
          -DWITH_CUDA_BACKEND=ON \
          -DWITH_OPENCL_BACKEND=ON \
          -DWITH_ROCM_BACKEND=ON \
          -DWITH_LEVEL_ZERO_BACKEND=ON  \
          -DACPP_USE_ACCELERATED_CPU=ON  \
          -DACPP_COMPILER_FEATURE_PROFILE="full" .. && \
    make -j && \
    make install

FROM adaptivecpp-amd-lz-oneapi-clang AS generic_backend
RUN --mount=target=/var/lib/apt/lists,type=cache,sharing=locked \
    --mount=target=/var/cache/apt,type=cache,sharing=locked \
    rm -f /etc/apt/apt.conf.d/docker-clean && \
    apt-fast update && \
    apt-fast upgrade -y --no-install-recommends && \
    apt-fast -y autoremove

FROM generic_backend AS builder
COPY . /app
WORKDIR /app/build
ARG APP_MALLOC_TYPE="tcmalloc"
RUN cmake -DCMAKE_BUILD_TYPE=$CMAKE_BUILD_TYPE \
          -DMALLOC_TYPE=$APP_MALLOC_TYPE \
          -DCMAKE_C_COMPILER=$CMAKE_C_COMPILER \
          -DCMAKE_CXX_COMPILER=$CMAKE_CXX_COMPILER \
          -DCLANG_EXECUTABLE_PATH=$CLANG_EXECUTABLE_PATH \
          -DLLVM_DIR=$LLVM_DIR .. && \
     make -j && \
     make install

## setup a build/dev environment
FROM generic_backend AS devimage
ARG USER=coder
ARG UID=1000
ARG GID=1000
RUN if getent passwd ${UID}; then userdel -f $(getent passwd ${UID} | cut -d: -f1); fi && \
    if getent group ${GID}; then groupdel $(getent group ${GID} | cut -d: -f1); fi && \
    groupadd -g ${GID} ${USER} && \
    useradd --uid ${UID} --gid ${GID} --groups sudo --create-home --shell /bin/bash ${USER} && \
    echo "${USER} ALL=(ALL) NOPASSWD:ALL" >/etc/sudoers.d/${USER} && \
    chmod 0440 /etc/sudoers.d/${USER} && \
    mkdir -p /home/${USER}/projects /root/.ssh && \
    chmod 700 /root/.ssh && \
    chown -R ${USER}:${USER} /home/${USER} && \
    echo "${USER}:${USER}" | chpasswd

USER ${USER}
WORKDIR /home/${USER}/projects

ENTRYPOINT ["/bin/bash"]

FROM devimage AS ssh-devimage

USER root
WORKDIR /root/.ssh
# Install and configure OpenSSH server
RUN --mount=target=/var/lib/apt/lists,type=cache,sharing=locked \
    --mount=target=/var/cache/apt,type=cache,sharing=locked \
    rm -f /etc/apt/apt.conf.d/docker-clean && \
    apt-fast update && \
    apt-fast install -y --no-install-recommends openssh-server && \
    apt-fast -y autoremove && \
    apt-fast -y autoclean &&\
    mkdir -p /var/run/sshd /root/.ssh && \
    chmod 700 /root/.ssh && \
    echo 'PasswordAuthentication yes' >> /etc/ssh/sshd_config && \
    echo 'PermitRootLogin yes' >> /etc/ssh/sshd_config && \
    echo "root:root" | chpasswd

EXPOSE 22

# Run SSH daemon in the foreground so that the container stays alive
ENTRYPOINT ["/usr/sbin/sshd", "-D"]

## Runtime image with minimal dependencies
FROM amd-lz-oneapi-clang AS scramruntime
WORKDIR /app

# Install runtime packages
RUN --mount=target=/var/lib/apt/lists,type=cache,sharing=locked \
    --mount=target=/var/cache/apt,type=cache,sharing=locked \
    rm -f /etc/apt/apt.conf.d/docker-clean && \
    apt-fast update && \
    apt-fast install -y --no-install-recommends \
    $SCRAM_RUNTIME_PACKAGES \
    libatomic1 \
    libstdc++6 \
    libc6 \
    libgcc-s1 \
    liblzma5 \
    zlib1g \
    ca-certificates && \
    apt-fast -y autoremove && \
    apt-fast -y autoclean

# Copy AdaptiveCpp runtime libraries
COPY --from=adaptivecpp-amd-lz-oneapi-clang /usr/local/bin/acpp-info /usr/local/bin/
COPY --from=adaptivecpp-amd-lz-oneapi-clang /usr/local/lib/libacpp-rt.so /usr/local/lib/
COPY --from=adaptivecpp-amd-lz-oneapi-clang /usr/local/lib/libacpp-common.so /usr/local/lib/

# Copy built SCRAM binaries and libraries from builder stage
COPY --from=builder /app/build/targets/scram/scram-cli /usr/local/bin/
COPY --from=builder /app/build/src/libscram.so /usr/local/lib/
COPY --from=builder /app/build/src/mc/libmc.so /usr/local/lib/
COPY --from=builder /app/build/_deps/libxml2-build/libxml2.so.16 /usr/local/lib/

# Update library cache
RUN ldconfig

# AdaptiveCpp Runtime Environment Variables
# Configure default runtime behavior for GPU acceleration and debugging
# These can be overridden at runtime using docker run -e VARIABLE=value

# ACPP_VISIBILITY_MASK: Controls which backends are available
# Values: cuda, hip, opencl, lz, omp, or comma-separated combinations
# Default: cuda (NVIDIA GPU backend only for container optimization)
ENV ACPP_VISIBILITY_MASK=cuda

# ACPP_DEBUG_LEVEL: Controls debug output verbosity  
# Values: 0=Silent, 1=Fatal, 2=Errors, 3=Info, 4=All
# Default: 0 (silent for production use)
ENV ACPP_DEBUG_LEVEL=0

# ACPP_ADAPTIVITY_LEVEL: Controls runtime optimization level
# Values: 0=jit off, 1=less, 2=more
# Default: 2 (balanced performance and stability)
ENV ACPP_ADAPTIVITY_LEVEL=2

# ACPP_ALLOCATION_TRACKING: Enables memory allocation monitoring
# Values: 0=Disabled, 1=Enabled
# Default: 1 (basic tracking for memory usage awareness)
ENV ACPP_ALLOCATION_TRACKING=1

ENV ACPP_PERSISTENT_RUNTIME=1

# Set the entrypoint to the SCRAM binary
ENTRYPOINT ["/usr/local/bin/scram-cli"]
CMD ["--help"]