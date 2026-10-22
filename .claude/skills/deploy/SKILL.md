---
name: deploy
description: Build the launcher and push it to the phone with `npm run deploy` (vue-tsc + vite build, adb push of dist/, restart of Bridge). Only when the user asks for a deploy.
disable-model-invocation: true
model: haiku
allowed-tools: Bash(npm run deploy), Bash(npm run deploy:*), Bash(adb devices), Bash(REMOTE_DIR=* npm run deploy)
---

# Deploy to the phone

Runs `scripts/deploy.sh` through `npm run deploy`: type-check and build, wipe and refill
`$REMOTE_DIR` (default `/sdcard/projects/crt-launcher`) over adb, then force-stop and relaunch Bridge.

## Steps

1. Run `adb devices`. If no device is listed as `device` (none, `unauthorized` or `offline`), stop and tell the
   user to connect the phone and accept USB debugging. Do not try to fix adb yourself.
2. Run `npm run deploy` (timeout 300000 ms). If the user named another folder, run
   `REMOTE_DIR=<folder> npm run deploy`.
3. Report in Spanish, in one or two lines:
   - Success: the folder it was copied to and that Bridge was restarted.
   - Failure: which stage failed (type-check, build, adb push or restart) and the relevant error lines, verbatim.

## Rules

- Run the deploy once. Never retry it in a loop, and never edit code to make a failing build pass: report the
  error and stop.
- Don't commit, push to git, or run any other adb command.
