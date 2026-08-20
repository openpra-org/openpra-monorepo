FROM ubuntu:24.04

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install build dependencies for SCRAM and Hyperfine for benchmarking
# Also install Wine for FTREX
RUN apt-get update && \
    apt-get install -y \
        build-essential \
        cmake \
        libxml2-dev \
        libboost-all-dev \
        hyperfine \
        git \
        ninja-build \
        python3 \
        python3-lxml \
        python3-pip \
        wine64 \
        wine \
        gcc-mingw-w64-x86-64 \
        ca-certificates \
        curl && \
    pip3 install plotly --break-system-packages && \
    rm -rf /var/lib/apt/lists/*

# Set up Wine environment for FTREX
ENV WINEDEBUG=-all
ENV WINEPREFIX=/opt/wine
ENV WINEARCH=win64
RUN wine winecfg /v win10 || true

# Set up working directory for the build
WORKDIR /build

# Copy the SCRAM source code into the container
COPY apps/solvers/scram /build/scram

# Build SCRAM
RUN mkdir -p /build/scram/build
WORKDIR /build/scram/build
RUN cmake -DCMAKE_BUILD_TYPE=Release -G Ninja .. && \
    cmake --build . --target scram-cli

# Create symlinks so both scram-cli and scram resolve to the binary
RUN find /build/scram/build -name scram-cli -type f -executable -exec ln -s {} /usr/local/bin/scram-cli \; && \
    ln -s /usr/local/bin/scram-cli /usr/local/bin/scram

# Copy the Pracciolini tools into the container
COPY apps/utilities/pracciolini /build/pracciolini

# Build PRAXIS
RUN curl https://sh.rustup.rs -sSf | sh -s -- -y --default-toolchain stable
ENV PATH="/root/.cargo/bin:$PATH"
COPY apps/solvers/praxis /build/praxis
RUN cd /build/praxis && cargo build --release --bin praxis-cli
RUN ln -s /build/praxis/target/release/praxis-cli /usr/local/bin/praxis-cli

# Build saphsolve-cli as a Windows PE binary (runs via Wine)
RUN rustup target add x86_64-pc-windows-gnu
COPY apps/solvers/saphsolve/saphsolve-cli /build/saphsolve-cli
RUN cd /build/saphsolve-cli && \
    cargo build --release --target x86_64-pc-windows-gnu --bin saphsolve-cli

COPY apps/solvers/ftrex/run_ftrex.sh /opt/ftrex/run_ftrex.sh
RUN chmod +x /opt/ftrex/run_ftrex.sh && \
    ln -s /opt/ftrex/run_ftrex.sh /usr/local/bin/run_ftrex

# Copy the XFTA Linux binary and make it executable
COPY apps/solvers/xfta/xftar /usr/local/bin/xftar
RUN chmod +x /usr/local/bin/xftar

# Set up ZEBRA (ZTDD solver)
# The four VC++ 2013 runtime DLLs (mfc120u, msvcp120, msvcr120, vcomp120) are
# bundled in apps/solvers/zebra/ alongside the exe.
WORKDIR /opt/zebra
COPY apps/solvers/zebra/ /opt/zebra/
RUN chmod +x /opt/zebra/run_zebra.sh && \
    ln -s /opt/zebra/run_zebra.sh /usr/local/bin/run_zebra && \
    wine /opt/zebra/ZEBRA.exe /SERIAL=F26EC9597630EE17 || true

# Set up FTREX
WORKDIR /opt/ftrex
COPY apps/solvers/ftrex/ /opt/ftrex/
RUN chmod +x /opt/ftrex/ftrex && \
    ln -s /opt/ftrex/ftrex /usr/local/bin/ftrex && \
    /opt/ftrex/ftrex "/SERIAL=$(cat /opt/ftrex/Serial.txt | tr -d '\r\n')"

# Set up SAPHSOLVE — Wine-based Windows solver via saphsolve-cli.exe
WORKDIR /opt/saphsolve
COPY apps/solvers/saphsolve/tools/ /opt/saphsolve/
COPY apps/solvers/saphsolve/run_saphsolve.sh /opt/saphsolve/run_saphsolve.sh
RUN cp /build/saphsolve-cli/target/x86_64-pc-windows-gnu/release/saphsolve-cli.exe /opt/saphsolve/ && \
    chmod +x /opt/saphsolve/run_saphsolve.sh && \
    mkdir -p /opt/saphsolve/Temp && \
    ln -s /opt/saphsolve/run_saphsolve.sh /usr/local/bin/saphsolve-cli

# Set up working directory for benchmarks
WORKDIR /benchmark

# Default command
CMD ["bash"]
