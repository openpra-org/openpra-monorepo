#!/usr/bin/env bash
set -euo pipefail

# Skip postinstall in CI to avoid missing 'make install' target errors
if [[ -n "${CI:-}" ]]; then
  echo "[scram] Skipping postinstall in CI"
  exit 0
fi

# Only attempt make install if a Makefile exists with an 'install' target
if [[ -f build/Makefile ]] && grep -qE '^install:' build/Makefile; then
  echo "[scram] Running make install"
  make -C build install

  # If we installed into a system prefix (default is /usr/local), refresh the
  # dynamic linker cache so newly installed shared libraries (e.g. libscram.so,
  # libxml2.so) are discoverable immediately.
  if command -v ldconfig >/dev/null 2>&1; then
    if [[ "$(id -u)" == "0" ]]; then
      echo "[scram] Running ldconfig"
      ldconfig || true
    else
      echo "[scram] Skipping ldconfig (not running as root)"
    fi
  fi
else
  echo "[scram] No install target found, skipping make install"
fi

# Run path update helper if present
if [[ -x scripts/inform_update_paths.sh ]]; then
  ./scripts/inform_update_paths.sh || true
fi
