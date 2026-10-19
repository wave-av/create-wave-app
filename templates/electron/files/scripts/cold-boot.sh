#!/bin/bash
# cold-boot.sh — prove `npm run dist` yields a launchable arm64 dmg that
# cold-boots against a SCRATCH port and never touches live :__PORT__.
#
# Steps: start scratch server (ephemeral port) -> unsigned `npm run dist`
# (CSC_IDENTITY_AUTO_DISCOVERY=false; release signs with a real Developer
# ID) -> assert dmg+zip exist and the app binary is arm64 -> mount the DMG,
# copy the .app out, launch it with __PORT_ENV__=<scratch> --smoke-test ->
# assert SMOKE_OK (scratch port, product title, preload bridge present,
# zero node leak) and that no socket to :__PORT__ was opened.
set -euo pipefail

cd "$(dirname "$0")/.."
WORK="$(mktemp -d /tmp/__APP_SLUG__-proof.XXXXXX)"
MNT="/tmp/__APP_SLUG__-proof-mnt"
trap 'kill $SCRATCH_PID 2>/dev/null || true; rm -rf "$WORK"; hdiutil detach "$MNT" -quiet 2>/dev/null || true' EXIT

echo "== 1. scratch server (ephemeral port, never :__PORT__)"
node scripts/scratch-server.mjs >"$WORK/scratch.json" 2>"$WORK/scratch.err" &
SCRATCH_PID=$!
for _ in $(seq 1 100); do
  [ -s "$WORK/scratch.json" ] && break
  sleep 0.1
done
[ -s "$WORK/scratch.json" ] || { echo "FAIL: scratch server did not print its port"; cat "$WORK/scratch.err"; exit 1; }
SCRATCH_PORT="$(node -e "console.log(JSON.parse(require('fs').readFileSync('$WORK/scratch.json','utf8')).port)")"
[ "$SCRATCH_PORT" != "__PORT__" ] || { echo "FAIL: scratch port is live :__PORT__"; exit 1; }
echo "scratch server pid=$SCRATCH_PID port=$SCRATCH_PORT"

echo "== 2. npm run dist (unsigned local build)"
CSC_IDENTITY_AUTO_DISCOVERY=false npm run dist 2>&1 | tail -n 15

echo "== 3. artifacts"
DMG="$(ls -t dist/*.dmg | head -1)"
ZIP="$(ls -t dist/*.zip | head -1)"
ls -la "$DMG" "$ZIP"
case "$DMG" in *"__APP_NAME__"*) ;; *) echo "FAIL: dmg name must carry the product name: $DMG"; exit 1;; esac
APP_DIR="dist/mac-arm64/__APP_NAME__.app"
BIN="$APP_DIR/Contents/MacOS/__APP_NAME__"
[ -x "$BIN" ] || { echo "FAIL: no app binary at $BIN"; exit 1; }
ARCHS="$(lipo -archs "$BIN")"
echo "binary archs: $ARCHS"
[ "$ARCHS" = "arm64" ] || { echo "FAIL: expected arm64-only, got $ARCHS"; exit 1; }

echo "== 4. mount DMG, stage the shipped .app"
hdiutil attach "$DMG" -mountpoint "$MNT" -nobrowse -quiet
cp -R "$MNT/__APP_NAME__.app" "$WORK/Shipped.app"
hdiutil detach "$MNT" -quiet
SHIPPED_BIN="$WORK/Shipped.app/Contents/MacOS/__APP_NAME__"
[ -x "$SHIPPED_BIN" ] || { echo "FAIL: DMG has no launchable __APP_NAME__.app"; exit 1; }

echo "== 5. cold-boot shipped .app against scratch :$SCRATCH_PORT"
__PORT_ENV__="$SCRATCH_PORT" "$SHIPPED_BIN" --smoke-test >"$WORK/smoke.log" 2>&1 &
APP_PID=$!
# While it runs, poll for any socket to live :__PORT__ from the app tree.
TOUCHED_LIVE=0
for _ in $(seq 1 150); do
  grep -q "SMOKE_OK\|SMOKE_FAIL" "$WORK/smoke.log" 2>/dev/null && break
  if lsof -a -p "$APP_PID" -iTCP:__PORT__ -sTCP:ESTABLISHED 2>/dev/null | grep -q .; then TOUCHED_LIVE=1; fi
  sleep 0.2
done
wait "$APP_PID" && APP_RC=0 || APP_RC=$?
cat "$WORK/smoke.log"
[ $TOUCHED_LIVE -eq 0 ] || { echo "FAIL: app opened a socket to live :__PORT__"; exit 1; }
[ $APP_RC -eq 0 ] || { echo "FAIL: shipped app smoke exited $APP_RC"; exit 1; }

echo "== 6. assertions on SMOKE_OK"
SMOKE="$(grep "SMOKE_OK" "$WORK/smoke.log" | head -1)"
node -e "
const s = JSON.parse(process.argv[1].slice(process.argv[1].indexOf('{')));
const assert = require('node:assert');
assert.equal(s.port, $SCRATCH_PORT, 'smoke port must equal scratch port');
assert.notEqual(s.port, __PORT__, 'must never boot against live :__PORT__');
assert.match(s.title, /__APP_NAME__/, 'desk page title must carry the product name');
assert.equal(s.hasBridge, true, 'preload bridge window.__BRIDGE__ must exist');
assert.equal(s.nodeLeak, false, 'zero node exposure: no require/process in page');
console.log('PASS: port=' + s.port + ' title=' + JSON.stringify(s.title));
" "$SMOKE"

echo "COLD-BOOT PASS: $(basename "$DMG") cold-boots on scratch :$SCRATCH_PORT, :__PORT__ untouched"
