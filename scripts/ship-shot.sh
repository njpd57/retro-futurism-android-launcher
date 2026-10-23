#!/usr/bin/env bash
# Draws the ship panel once from a camera and saves a PNG (headless Chrome, software WebGL). Prints the PNG's path.
# Usage: ship-shot.sh X Y YAW PITCH [DOORS 0..1] [OUT.png] [WIDTH HEIGHT]
#   X Y: plan metres (x east, y south); YAW 0 = north, clockwise, radians; PITCH up positive, radians.
# EYE=1.15 sets the eye height (a seat), 1.6 by default.
# Needs `npm run dev` on $PORT (default 5173) or starts one for the run.
set -euo pipefail

cd "$(dirname "$0")/.."

X="${1:?x}"; Y="${2:?y}"; YAW="${3:?yaw}"; PITCH="${4:?pitch}"
DOORS="${5:-0}"
OUT="${6:-${TMPDIR:-/tmp}/ship-shot.png}"
W="${7:-800}"; H="${8:-800}"
PORT="${PORT:-5173}"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"

started=""
if ! curl -s -o /dev/null "http://localhost:$PORT/shot.html"; then
    npx vite --port "$PORT" --strictPort >/dev/null 2>&1 &
    started=$!
    trap '[ -n "$started" ] && kill "$started" 2>/dev/null || true' EXIT
    for _ in $(seq 1 40); do curl -s -o /dev/null "http://localhost:$PORT/shot.html" && break; sleep 0.25; done
fi

"$CHROME" --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist \
    --hide-scrollbars --window-size="$W,$H" --virtual-time-budget=8000 \
    --screenshot="$OUT" "http://localhost:$PORT/shot.html?x=$X&y=$Y&yaw=$YAW&pitch=$PITCH&doors=$DOORS&eye=${EYE:-1.6}" >/dev/null 2>&1
echo "$OUT"
