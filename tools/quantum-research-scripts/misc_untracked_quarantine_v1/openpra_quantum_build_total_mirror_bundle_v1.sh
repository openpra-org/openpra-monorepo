#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="/mnt/storage_array/projects/OPENPRA_DEV_v1/openpra-monorepo"
PROJECT_ROOT="/mnt/storage_array/projects/OPENPRA_DEV_v1"
OUT_ROOT="$PROJECT_ROOT/openpra_total_mirror_bundle_v1"
STAMP="$(date -u +%Y%m%d_%H%M%SZ)"
BUNDLE_NAME="OPENPRA_TOTAL_MIRROR_BUNDLE_v1_${STAMP}"
RUN_DIR="$OUT_ROOT/$BUNDLE_NAME"
TAR_PATH="$OUT_ROOT/${BUNDLE_NAME}.tar.gz"
SHA_PATH="${TAR_PATH}.sha256"

mkdir -p "$RUN_DIR/meta"
mkdir -p "$OUT_ROOT"

cd "$REPO_ROOT"

echo "Building total mirror bundle at:"
echo "  $RUN_DIR"

git rev-parse HEAD > "$RUN_DIR/meta/HEAD_COMMIT.txt" || true
git rev-parse --abbrev-ref HEAD > "$RUN_DIR/meta/BRANCH.txt" || true
git status --short > "$RUN_DIR/meta/GIT_STATUS_SHORT.txt" || true
git log --oneline -n 100 > "$RUN_DIR/meta/GIT_LOG_ONELINE_100.txt" || true

cat > "$RUN_DIR/README.txt" <<EOF
OpenPRA Total Mirror Bundle v1

Generated UTC: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

Purpose
This bundle is a full mirror style export of the entire openpra-monorepo directory.

Included
1. .git
2. _work
3. tracked files
4. untracked files
5. generated outputs
6. all subdirectories under the repo root

Excluded
1. the mirror export directory itself so the tar does not recursively include itself

Authoritative repo root
$REPO_ROOT
EOF

{
  echo "BUNDLE_NAME=$BUNDLE_NAME"
  echo "GENERATED_UTC=$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo "REPO_ROOT=$REPO_ROOT"
  if [ -f "$RUN_DIR/meta/HEAD_COMMIT.txt" ]; then
    echo "HEAD_COMMIT=$(cat "$RUN_DIR/meta/HEAD_COMMIT.txt")"
  fi
  if [ -f "$RUN_DIR/meta/BRANCH.txt" ]; then
    echo "BRANCH=$(cat "$RUN_DIR/meta/BRANCH.txt")"
  fi
  echo
  echo "[TOP_LEVEL_REPO_CONTENTS]"
  find "$REPO_ROOT" -mindepth 1 -maxdepth 1 \
    ! -path "$OUT_ROOT" \
    ! -path "$RUN_DIR" \
    | sort
} > "$RUN_DIR/MANIFEST.txt"

tar \
  --exclude="$OUT_ROOT" \
  -C "$PROJECT_ROOT" \
  -czf "$TAR_PATH" \
  "$(basename "$REPO_ROOT")"

sha256sum "$TAR_PATH" > "$SHA_PATH"

echo
echo "Bundle directory:"
echo "$RUN_DIR"
echo
echo "Tarball:"
echo "$TAR_PATH"
echo
echo "SHA256:"
echo "$SHA_PATH"
echo
ls -lh "$TAR_PATH" "$SHA_PATH"
