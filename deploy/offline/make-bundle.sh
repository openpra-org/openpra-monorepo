#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="${1:-$ROOT/openpra-offline-out}"
STAGE="$OUT/openpra-offline"
PART_SIZE="${PART_SIZE:-1900m}"
DOCUMENTS="apps/backends/web-backend/example-documents"
PRAETOR_ENV="deploy/microservices/praetor/configs/cd.stack.env"

export DOCKER_DEFAULT_PLATFORM=linux/amd64

if command -v sha256sum >/dev/null 2>&1; then
  SHA256=(sha256sum)
else
  SHA256=(shasum -a 256)
fi

cd "$ROOT"

if grep -rlF "version https://git-lfs.github.com/spec/v1" "$DOCUMENTS" >/dev/null; then
  echo "The example documents are Git LFS pointers. Run git lfs pull, then run this script again."
  exit 1
fi

rm -rf "$STAGE" "$OUT"/openpra-offline-bundle.tar.gz.part-* "$OUT/openpra-offline-bundle.sha256"
mkdir -p "$STAGE/$(dirname "$PRAETOR_ENV")" "$STAGE/$(dirname "$DOCUMENTS")"

echo "==> Writing the offline settings"
printf '%s\n' "COMPOSE_PROJECT_NAME=openpra-offline" "TFA_TIME_URL=" > "$STAGE/deploy/.env"

COMPOSE=(docker compose --env-file "$STAGE/deploy/.env" -f deploy/compose.yml)

echo "==> Building the app images one service at a time"
for service in $("${COMPOSE[@]}" config --services); do
  "${COMPOSE[@]}" build "$service"
done

echo "==> Pulling the pinned infrastructure images"
"${COMPOSE[@]}" pull --ignore-buildable

echo "==> Saving every image to one tar"
docker save -o "$STAGE/openpra-images.tar" $("${COMPOSE[@]}" config --images | sort -u)

echo "==> Collecting the runtime files"
cp deploy/compose.yml "$STAGE/deploy/compose.yml"
cp "$PRAETOR_ENV" "$STAGE/$PRAETOR_ENV"
cp -r "$DOCUMENTS" "$STAGE/$DOCUMENTS"
cp deploy/offline/INSTALL.md "$STAGE/INSTALL.md"

echo "==> Bundling the repository source"
git bundle create "$STAGE/openpra-repo.bundle" HEAD

echo "==> Packing the bundle in parts of $PART_SIZE"
tar -czf - -C "$OUT" openpra-offline | split -b "$PART_SIZE" - "$OUT/openpra-offline-bundle.tar.gz.part-"

echo "==> Writing the checksums"
(cd "$OUT" && "${SHA256[@]}" openpra-offline-bundle.tar.gz.part-* > openpra-offline-bundle.sha256)

echo "==> Done"
du -h "$OUT"/openpra-offline-bundle.tar.gz.part-*
