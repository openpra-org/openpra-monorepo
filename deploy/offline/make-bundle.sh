#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="${1:-$ROOT/openpra-offline-out}"
STAGE="$OUT/openpra-offline"

cd "$ROOT"
rm -rf "$STAGE"
mkdir -p "$STAGE"

echo "==> Building production bundles"
pnpm nx build backends-web-backend --configuration=production
pnpm nx build frontends-web-frontend --configuration=production

echo "==> Assembling backend image context"
rm -rf docker-context/web-backend docker-context/web-frontend
mkdir -p docker-context/web-backend
cp dist/apps/backends/web-backend/main.js docker-context/web-backend/main.js
cp apps/backends/web-backend/package.json docker-context/web-backend/package.json
node -e '
  const fs = require("fs");
  const path = "docker-context/web-backend/package.json";
  const pkg = JSON.parse(fs.readFileSync(path, "utf8"));
  for (const key of ["dependencies", "devDependencies"]) {
    if (!pkg[key]) continue;
    for (const [name, version] of Object.entries({ ...pkg[key] })) {
      if (typeof version === "string" && version.startsWith("workspace:")) delete pkg[key][name];
    }
  }
  delete pkg.devDependencies;
  fs.writeFileSync(path, JSON.stringify(pkg, null, 2));
'
cp deploy/web/backend.Dockerfile docker-context/web-backend/Dockerfile

echo "==> Building backend image"
docker build -t openpra-apps-web-backend:local docker-context/web-backend

echo "==> Assembling frontend image context"
mkdir -p docker-context/web-frontend/html
cp -r dist/apps/frontends/web-frontend/. docker-context/web-frontend/html/
cp deploy/web/nginx.conf docker-context/web-frontend/nginx.conf
cp deploy/web/frontend.Dockerfile docker-context/web-frontend/Dockerfile

echo "==> Building frontend image"
docker build -t openpra-apps-web-frontend:local docker-context/web-frontend

echo "==> Pulling infrastructure images"
docker pull mongo:latest
docker pull minio/minio:latest

echo "==> Saving all images to one tar"
docker save -o "$STAGE/openpra-images.tar" \
  openpra-apps-web-backend:local \
  openpra-apps-web-frontend:local \
  mongo:latest \
  minio/minio:latest

echo "==> Collecting runtime files"
cp deploy/offline/docker-compose.offline.yml "$STAGE/docker-compose.yml"
cp deploy/offline/INSTALL.md "$STAGE/INSTALL.md"
cp docker/nginx-frontend.preview.conf "$STAGE/nginx-frontend.conf"
cp -r dist/apps/backends/web-backend/example-documents "$STAGE/example-documents"

echo "==> Bundling the repository source"
git bundle create "$STAGE/openpra-repo.bundle" revamp

echo "==> Creating final tarball"
tar -czf "$OUT/openpra-offline-bundle.tar.gz" -C "$OUT" openpra-offline

echo "==> Done"
du -h "$OUT/openpra-offline-bundle.tar.gz"
