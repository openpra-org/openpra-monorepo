FROM node:20.2.0-slim AS base

ENV DEBIAN_FRONTEND=noninteractive
WORKDIR /app

SHELL ["/bin/bash", "-c"]
RUN npm install --global pnpm nx@16.5.4 \
    && SHELL=bash pnpm setup

COPY . .
RUN source /root/.bashrc \
    && pnpm install --shamefully-hoist=true

FROM base as frontend_builder
ARG BUILD_TYPE=development
WORKDIR /app
SHELL ["/bin/bash", "-c"]
RUN source /root/.bashrc \
    && nx run frontend-web-editor:build:$BUILD_TYPE

FROM nginx:latest as frontend
WORKDIR /usr/share/nginx/html/web-editor
COPY ./docker/default.conf /etc/nginx/nginx.conf
COPY --from=frontend_builder /app/dist/packages/frontend/web-editor/ ./

FROM base as backend
WORKDIR /app
SHELL ["/bin/bash", "-c"]
CMD source /root/.bashrc && nx run web-backend:serve:$BUILD_TYPE
