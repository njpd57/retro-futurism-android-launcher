#!/usr/bin/env bash
# Builds the project and copies dist/ to the phone over adb.
# Point Bridge's "project dir" at $REMOTE_DIR once; later deploys just replace its contents.
set -euo pipefail

cd "$(dirname "$0")/.."

REMOTE_DIR="${REMOTE_DIR:-/sdcard/projects/crt-launcher}"

npm run build

adb shell rm -rf "$REMOTE_DIR"
adb shell mkdir -p "$REMOTE_DIR"
adb push dist/. "$REMOTE_DIR/"

echo "Deployed to $REMOTE_DIR"
