# Multi-stage build for VitePress documentation
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY nx.json tsconfig.base.json ./

# Install pnpm
RUN npm install -g pnpm@10.19.0

# Copy docs package
COPY packages/docs-md ./packages/docs-md

# Copy other required packages for TypeDoc generation
COPY packages/mef-types ./packages/mef-types
COPY packages/shared-types ./packages/shared-types
COPY packages/shared-sdk ./packages/shared-sdk
COPY packages/model-generator ./packages/model-generator
COPY packages/web-backend ./packages/web-backend
COPY packages/microservices/raptor ./packages/microservices/raptor
COPY packages/frontend/web-editor ./packages/frontend/web-editor
COPY packages/engine/scram ./packages/engine/scram

# Install dependencies
RUN pnpm install --frozen-lockfile --ignore-scripts

# Install system dependencies for Doxygen
RUN apk add --no-cache doxygen graphviz wget unzip

# Install Doxybook2
RUN wget -O /tmp/doxybook2.zip https://github.com/matusnovak/doxybook2/releases/download/v1.5.0/doxybook2-linux-amd64-v1.5.0.zip && \
    unzip /tmp/doxybook2.zip -d /usr/local && \
    chmod +x /usr/local/bin/doxybook2 && \
    rm /tmp/doxybook2.zip

# Build documentation
ARG VITEPRESS_BASE=/
ENV VITEPRESS_BASE=${VITEPRESS_BASE}
ENV NX_NO_CLOUD=true

RUN pnpm nx run docs-md:site:build --no-cloud

# Production stage - serve with nginx
FROM nginx:alpine

# Copy built documentation
COPY --from=builder /app/packages/docs-md/.vitepress/dist /usr/share/nginx/html

# Create nginx config that handles SPA routing
RUN echo 'server { \
    listen 80; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ { \
        expires 1y; \
        add_header Cache-Control "public, immutable"; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
