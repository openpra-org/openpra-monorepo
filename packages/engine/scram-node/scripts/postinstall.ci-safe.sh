#!/usr/bin/env bash
set -euo pipefail

# Skip postinstall in CI to avoid missing 'make install' target errors
if [[ -n "${CI:-}" ]]; then
  echo "[scram-node] Skipping postinstall in CI"
  exit 0
fi

# Only attempt make install if a Makefile exists with an 'install' target
if [[ -f build/Makefile ]] && grep -qE '^install:' build/Makefile; then
  echo "[scram-node] Running make install"
  make -C build install
else
  echo "[scram-node] No install target found, skipping make install"
fi

# Run path update helper if present
if [[ -x scripts/inform_update_paths.sh ]]; then
  ./scripts/inform_update_paths.sh || true
fi
