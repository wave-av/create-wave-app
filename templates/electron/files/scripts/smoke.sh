#!/bin/bash
# smoke.sh — dev-mode smoke: boot the unpacked app (`npx electron .`) against
# a scratch server and assert first paint + preload bridge + zero node leak.
# Never touches live :__PORT__. Fast; run on every change.
set -euo pipefail

cd "$(dirname "$0")/.."
WORK="$(mktemp -d /tmp/__APP_SLUG__-smoke.XXXXXX)"
trap 'kill $SCRATCH_PID 2>/dev/null || true; rm -rf "$WORK"' EXIT

node scripts/scratch-server.mjs >"$WORK/scratch.json" 2>"$WORK/scratch.err" &
SCRATCH_PID=$!
for _ in $(seq 1 100); do
  [ -s "$WORK/scratch.json" ] && break
  sleep 0.1
done
[ -s "$WORK/scratch.json" ] || { echo "FAIL: scratch server did not print its port"; cat "$WORK/scratch.err"; exit 1; }
SCRATCH_PORT="$(node -e "console.log(JSON.parse(require('fs').readFileSync('$WORK/scratch.json','utf8')).port)")"
echo "scratch server pid=$SCRATCH_PID port=$SCRATCH_PORT"

__PORT_ENV__="$SCRATCH_PORT" npx electron . --smoke-test >"$WORK/smoke.log" 2>&1
cat "$WORK/smoke.log"

SMOKE="$(grep "SMOKE_OK" "$WORK/smoke.log" | head -1)"
[ -n "$SMOKE" ] || { echo "FAIL: no SMOKE_OK line"; exit 1; }
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

echo "SMOKE PASS: __APP_NAME__ paints on scratch :$SCRATCH_PORT, :__PORT__ untouched"
