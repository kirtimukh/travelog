#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_FILE="${1:-$ROOT_DIR/../maptiles/india-ne.pmtiles}"
DEST_FILE="/sdcard/Download/india-ne.pmtiles"

if [[ ! -f "$SRC_FILE" ]]; then
  echo "Source file not found: $SRC_FILE" >&2
  exit 1
fi

if ! command -v adb >/dev/null 2>&1; then
  echo "adb is not installed or not in PATH" >&2
  exit 1
fi

adb devices
adb push "$SRC_FILE" "$DEST_FILE"
echo "Preloaded PMTiles to emulator: $DEST_FILE"
echo "Now open the app and upload india-ne.pmtiles from Files/Downloads."
