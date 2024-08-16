FROM node:20.17.0-slim AS base

ENV DEBIAN_FRONTEND=noninteractive
ENV NX_VERSION=19.6.2
ENV BUILD_PACKAGES="make cmake g++ python3 curl ca-certificates"

ENV SCRAM_BUILD_PACKAGES="libxml2-dev libomp-dev \
    libxml2-dev libomp-dev \
    libgoogle-perftools-dev libboost-program-options-dev \
    libboost-math-dev libboost-random-dev libboost-filesystem-dev \
    libboost-test-dev libboost-date-time-dev libjemalloc-dev"

ENV SCRAM_RUNTIME_PACKAGES="libxml2 \
    libboost-filesystem1.74.0 libboost-program-options1.74.0 \
    libtcmalloc-minimal4 libjemalloc2"

ENV PATH="/root/.local/bin:${PATH}"

WORKDIR /data/project
SHELL ["/bin/bash", "-c"]
RUN --mount=target=/var/lib/apt/lists,type=cache,sharing=locked \
    --mount=target=/var/cache/apt,type=cache,sharing=locked \
    rm -f /etc/apt/apt.conf.d/docker-clean && \
    apt update && \
    apt install -y --no-install-recommends $BUILD_PACKAGES $SCRAM_BUILD_PACKAGES $SCRAM_RUNTIME_PACKAGES && \
    update-ca-certificates && \
    npm install --global pnpm nx@$NX_VERSION && \
    SHELL=bash pnpm setup

COPY . .
RUN source /root/.bashrc \
    && pnpm install

FROM base AS e2e-tests
RUN source /root/.bashrc && \
    pnpm playwright install-deps

FROM base AS frontend_builder
ARG BUILD_TYPE=development
ARG BRANCH_SLUG=""
ARG ENABLE_SENTRY=1

WORKDIR /data/project
SHELL ["/bin/bash", "-c"]
RUN source /root/.bashrc && \
    BRANCH_SLUG=$BRANCH_SLUG NODE_ENV=$BUILD_TYPE ENABLE_SENTRY=$ENABLE_SENTRY nx run frontend-web-editor:build:$BUILD_TYPE

FROM nginx:latest AS frontend
WORKDIR /usr/share/nginx/html/web-editor
COPY --from=frontend_builder /data/project/dist/packages/frontend/web-editor/ ./

FROM base AS backend
WORKDIR /data/project
SHELL ["/bin/bash", "-c"]
CMD source /root/.bashrc && nx run --verbose web-backend:serve:$BUILD_TYPE


