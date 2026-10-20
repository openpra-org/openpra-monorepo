FROM node:20.17.0-slim AS source
ENV CI=true \
    NX_DAEMON=false \
    NX_NO_CLOUD=true \
    NODE_OPTIONS=--max-old-space-size=4096
RUN npm install -g pnpm@10.19.0
WORKDIR /src
COPY . .
RUN --mount=type=cache,id=openpra-pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts --store-dir /pnpm/store

FROM source AS backend-build
RUN pnpm nx build backends-web-backend --configuration=container

FROM source AS frontend-build
RUN pnpm nx build frontends-web-frontend --configuration=production

FROM node:20.17.0-slim AS backend-dependencies
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY apps/backends/web-backend/package.json ./package.json
RUN node -e "const fs = require('fs'); const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')); pkg.dependencies = Object.fromEntries(Object.entries(pkg.dependencies ?? {}).filter(([, version]) => !String(version).startsWith('workspace:'))); delete pkg.devDependencies; fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));"
RUN npm install --omit=dev --no-audit --no-fund

FROM node:20.17.0-slim AS backend
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8000
COPY --from=backend-dependencies /app/node_modules ./node_modules
COPY --from=backend-build /src/dist/apps/backends/web-backend/main.js ./main.js
COPY --from=backend-build /src/dist/apps/backends/web-backend/da-datasets ./da-datasets
EXPOSE 8000
CMD ["node", "main.js"]

FROM nginx:1.25.5-alpine AS frontend
COPY deploy/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-build /src/dist/apps/frontends/web-frontend/ /usr/share/nginx/html/
EXPOSE 80
