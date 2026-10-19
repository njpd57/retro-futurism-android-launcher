#!/usr/bin/env bash
# Builds the project, copies dist/ to the phone over adb and restarts Bridge.
# Point Bridge's "project dir" at $REMOTE_DIR once; later deploys just replace its contents.
set -euo pipefail

cd "$(dirname "$0")/.."

REMOTE_DIR="${REMOTE_DIR:-/sdcard/projects/crt-launcher}"
BRIDGE_PACKAGE="${BRIDGE_PACKAGE:-com.tored.bridgelauncher}"

npm run build

adb shell rm -rf "$REMOTE_DIR"
adb shell mkdir -p "$REMOTE_DIR"
adb push dist/. "$REMOTE_DIR/"

echo "Deployed to $REMOTE_DIR"

# Restart Bridge so it loads the new files.
adb shell am force-stop "$BRIDGE_PACKAGE"
adb shell monkey -p "$BRIDGE_PACKAGE" -c android.intent.category.LAUNCHER 1 >/dev/null

echo "Restarted $BRIDGE_PACKAGE"
