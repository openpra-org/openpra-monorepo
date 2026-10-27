#!/usr/bin/env bash
set -euo pipefail

DOCKER_VERSION="${DOCKER_VERSION:-29.9.2}"
COMPOSE_VERSION="${COMPOSE_VERSION:-5.6.1}"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="${1:-$ROOT/openpra-offline-out}"
STAGE="$OUT/docker-engine-offline"

if command -v sha256sum >/dev/null 2>&1; then
  SHA256=(sha256sum)
else
  SHA256=(shasum -a 256)
fi

rm -rf "$STAGE"
mkdir -p "$STAGE"

echo "==> Downloading Docker $DOCKER_VERSION static binaries"
curl -fL -o "$STAGE/docker-$DOCKER_VERSION.tgz" "https://download.docker.com/linux/static/stable/x86_64/docker-$DOCKER_VERSION.tgz"

echo "==> Downloading Compose plugin v$COMPOSE_VERSION"
curl -fL -o "$STAGE/docker-compose-linux-x86_64" "https://github.com/docker/compose/releases/download/v$COMPOSE_VERSION/docker-compose-linux-x86_64"

cp "$ROOT/deploy/offline/install-docker.sh" "$STAGE/install-docker.sh"
cp "$ROOT/deploy/offline/INSTALL-DOCKER.md" "$STAGE/INSTALL-DOCKER.md"

echo "==> Creating tarball"
tar -czf "$OUT/docker-engine-offline.tar.gz" -C "$OUT" docker-engine-offline

echo "==> Writing the checksum"
(cd "$OUT" && "${SHA256[@]}" docker-engine-offline.tar.gz > docker-engine-offline.sha256)

echo "==> Done"
du -h "$OUT/docker-engine-offline.tar.gz"
