FROM node:lts-slim AS base

ENV DEBIAN_FRONTEND=noninteractive
WORKDIR /app

SHELL ["/bin/bash", "-c"]
RUN npm install --global pnpm \
    && SHELL=bash pnpm setup \
    && source /root/.bashrc \
    && pnpm install --global nx@16.3.1

COPY . .
RUN source /root/.bashrc \
    && pnpm install --shamefully-hoist=true

FROM base as frontend_builder
WORKDIR /app
SHELL ["/bin/bash", "-c"]
RUN source /root/.bashrc \
    && nx build frontend-web-editor

FROM nginx:latest as frontend
WORKDIR /usr/share/nginx/html
COPY ./docker/default.conf /etc/nginx/default.conf
COPY --from=frontend_builder /app/dist/packages/frontend/web-editor/ ./

FROM base as backend_builder
WORKDIR /app
SHELL ["/bin/bash", "-c"]
RUN source /root/.bashrc \
    && nx build web-backend

FROM backend_builder as backend
WORKDIR /app/dist/packages/web-backend
SHELL ["/bin/bash", "-c"]
RUN source /root/.bashrc \
    && node serve
