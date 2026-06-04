#!/usr/bin/env bash
set -euo pipefail

# Installer for Doxybook2 (Linux amd64 v1.5.0).
# Echoes the path to the doxybook2 binary on success.

if command -v doxybook2 >/dev/null 2>&1; then
  echo "doxybook2"
  exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PKG_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
INSTALL_DIR="$PKG_DIR/.tmp/tools/doxybook2"
BIN_PATH="$INSTALL_DIR/doxybook2"
ZIP_PATH="$INSTALL_DIR/doxybook2-linux-amd64-v1.5.0.zip"
URL="https://github.com/matusnovak/doxybook2/releases/download/v1.5.0/doxybook2-linux-amd64-v1.5.0.zip"

mkdir -p "$INSTALL_DIR"

# Download if not present
if [ ! -f "$ZIP_PATH" ]; then
  echo "Downloading Doxybook2 from $URL" >&2
  curl -fsSL "$URL" -o "$ZIP_PATH"
fi

# Extract if binary not present
if [ ! -x "$BIN_PATH" ]; then
  echo "Extracting Doxybook2 to $INSTALL_DIR" >&2
  python3 - "$ZIP_PATH" "$INSTALL_DIR" <<'PY'
import sys, zipfile, os
zip_path, out_dir = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(zip_path) as z:
    z.extractall(out_dir)
# Ensure binary is executable if present at common path
candidates = [
    os.path.join(out_dir, 'doxybook2'),
    os.path.join(out_dir, 'bin', 'doxybook2'),
]
for c in candidates:
    if os.path.isfile(c):
        os.chmod(c, 0o755)
PY
fi

# Locate binary
if [ -x "$BIN_PATH" ]; then
  echo "$BIN_PATH"
  exit 0
fi
if [ -x "$INSTALL_DIR/bin/doxybook2" ]; then
  echo "$INSTALL_DIR/bin/doxybook2"
  exit 0
fi

# Fallback: try to find in extracted tree
FOUND_BIN=$(find "$INSTALL_DIR" -type f -name doxybook2 -perm -u+x | head -n1 || true)
if [ -n "${FOUND_BIN:-}" ]; then
  echo "$FOUND_BIN"
  exit 0
fi

echo "Failed to install or locate doxybook2" >&2
exit 1
