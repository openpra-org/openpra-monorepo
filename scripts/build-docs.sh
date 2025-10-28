#!/usr/bin/env bash
set -euo pipefail

# Ensure all nested Nx invocations skip Nx Cloud unless explicitly overridden
export NX_NO_CLOUD=true

# Aggregate docs builder for OpenPRA monorepo
# Outputs site to dist/docs

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
DIST_DIR="$ROOT_DIR/dist/docs"

mkdir -p "$DIST_DIR"

# 1) Build TS docs via Nx targets
pushd "$ROOT_DIR" >/dev/null

# Ensure pnpm is available (workflow handles setup); locally assume user has it

# shared-types
if [ -f packages/shared-types/typedoc.json ]; then
  echo "[docs] Building shared-types"
  pnpm nx run shared-types:docs --no-cloud
  rm -rf "$DIST_DIR/shared-types"
  mkdir -p "$DIST_DIR/shared-types"
  cp -R packages/shared-types/docs/* "$DIST_DIR/shared-types/" || true
fi

# shared-sdk
if [ -f packages/shared-sdk/typedoc.json ]; then
  echo "[docs] Building shared-sdk"
  pnpm nx run shared-sdk:docs --no-cloud
  rm -rf "$DIST_DIR/shared-sdk"
  mkdir -p "$DIST_DIR/shared-sdk"
  cp -R packages/shared-sdk/docs/* "$DIST_DIR/shared-sdk/" || true
fi

# model-generator
if [ -f packages/model-generator/typedoc.json ]; then
  echo "[docs] Building model-generator"
  pnpm nx run model-generator:docs --no-cloud
  rm -rf "$DIST_DIR/model-generator"
  mkdir -p "$DIST_DIR/model-generator"
  cp -R packages/model-generator/docs/* "$DIST_DIR/model-generator/" || true
fi

# microservice-job-broker
if [ -f packages/microservice/job-broker/typedoc.json ]; then
  echo "[docs] Building microservice-job-broker"
  pnpm nx run microservice-job-broker:docs --no-cloud
  rm -rf "$DIST_DIR/microservice-job-broker"
  mkdir -p "$DIST_DIR/microservice-job-broker"
  cp -R packages/microservice/job-broker/docs/* "$DIST_DIR/microservice-job-broker/" || true
fi

# web-backend
if [ -f packages/web-backend/typedoc.json ]; then
  echo "[docs] Building web-backend"
  pnpm nx run web-backend:docs --no-cloud
  rm -rf "$DIST_DIR/web-backend"
  mkdir -p "$DIST_DIR/web-backend"
  cp -R packages/web-backend/docs/* "$DIST_DIR/web-backend/" || true
fi

# mef-technical-elements (standalone npm project)
MEF_TE_DIR="packages/mef-types/src/openpra-mef/technical-elements"
if [ -f "$MEF_TE_DIR/typedoc.json" ]; then
  echo "[docs] Building mef-technical-elements"
  pushd "$MEF_TE_DIR" >/dev/null
  npm install --legacy-peer-deps
  npm run docs
  popd >/dev/null
  rm -rf "$DIST_DIR/mef-technical-elements"
  mkdir -p "$DIST_DIR/mef-technical-elements"
  cp -R "$MEF_TE_DIR/docs"/* "$DIST_DIR/mef-technical-elements/" || true
fi

# 2) Build C++ docs via Doxygen
if [ -f packages/engine/scram-node/Doxyfile ]; then
  echo "[docs] Building scram-node C++"
  pushd packages/engine/scram-node >/dev/null
  mkdir -p docs/cpp
  doxygen Doxyfile
  popd >/dev/null
  rm -rf "$DIST_DIR/scram-node"
  mkdir -p "$DIST_DIR/scram-node"
  cp -R packages/engine/scram-node/docs/cpp/html/* "$DIST_DIR/scram-node/" || true
fi

# 3) Landing page
cat > "$DIST_DIR/index.html" <<'HTML'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>OpenPRA Documentation</title>
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif;margin:2rem;line-height:1.5}
    h1{margin-bottom:1rem}
    ul{line-height:1.9}
    .note{color:#555;margin-top:2rem;font-size:.95rem}
  </style>
</head>
<body>
  <h1>OpenPRA Documentation</h1>
  <ul>
    <li><a href="./shared-types/">shared-types API</a></li>
    <li><a href="./shared-sdk/">shared-sdk API</a></li>
    <li><a href="./model-generator/">model-generator API</a></li>
    <li><a href="./microservice-job-broker/">job-broker API</a></li>
    <li><a href="./web-backend/">web-backend API</a></li>
    <li><a href="./mef-technical-elements/">MEF Technical Elements</a></li>
    <li><a href="./scram-node/">C++ Engine (scram-node)</a></li>
  </ul>
  <p class="note">This site aggregates per-package docs. Some sections may be absent if a package did not build or has no docs.</p>
</body>
</html>
HTML

popd >/dev/null

echo "[docs] Aggregated docs are in $DIST_DIR"
