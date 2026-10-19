#!/bin/bash
# brand-proof.sh — static brand assertions: the scaffolded app carries its
# own identity (never the template's) in package.json, the bundle config,
# the icon slots, and — when dist/ exists — the shipped artifacts.
set -uo pipefail

cd "$(dirname "$0")/.."
fail=0
check() { # check <desc> <command...> — records but never aborts
  local desc="$1"; shift
  if "$@" >/dev/null 2>&1; then echo "ok: $desc"; else echo "FAIL: $desc"; fail=1; fi
}
check_str() { # check_str <desc> <got> <want>
  if [ "$2" = "$3" ]; then echo "ok: $1 ($2)"; else echo "FAIL: $1 — got [$2] want [$3]"; fail=1; fi
}

PKG_NAME="$(node -p "require('./package.json').name")"
PKG_VERSION="$(node -p "require('./package.json').version")"
PRODUCT="$(node -p "require('./package.json').build.productName")"
APP_ID="$(node -p "require('./package.json').build.appId")"
FEED="$(node -p "require('./package.json').build.publish.url")"
ICON="$(node -p "require('./package.json').build.mac.icon")"

check_str "package name" "$PKG_NAME" "__APP_SLUG__"
check_str "package version" "$PKG_VERSION" "__APP_VERSION__"
check_str "productName" "$PRODUCT" "__APP_NAME__"
check_str "appId" "$APP_ID" "__APP_ID__"
check_str "update feed" "$FEED" "__FEED_URL__"
case "$FEED" in https://*) echo "ok: update feed is https";; *) echo "FAIL: update feed must be https (got $FEED)"; fail=1;; esac

check "icon slot $ICON exists" test -f "$ICON"
MAGIC="$(head -c 4 "$ICON" 2>/dev/null || true)"
check_str "icon slot magic" "$MAGIC" "icns"
check "icon master build/icon.png exists" test -f "build/icon.png"

check "preload exposes window.__BRIDGE__" grep -q "__BRIDGE__" preload.js
check "main registers __IPC__ channels" grep -q "__IPC__:version" main.js
check "updater points at the feed" grep -q "__FEED_URL__" updater.js

if ls dist/*.dmg >/dev/null 2>&1; then
  DMG="$(ls -t dist/*.dmg | head -1)"
  case "$DMG" in *"__APP_NAME__"*"__APP_VERSION__"*) echo "ok: dmg carries product+version ($DMG)";; *) echo "FAIL: dmg name must carry product+version ($DMG)"; fail=1;; esac
  APP_PLIST="dist/mac-arm64/__APP_NAME__.app/Contents/Info.plist"
  check "shipped Info.plist exists" test -f "$APP_PLIST"
  if [ -f "$APP_PLIST" ]; then
    BUNDLE_ID="$(/usr/libexec/PlistBuddy -c "Print CFBundleIdentifier" "$APP_PLIST" 2>/dev/null || true)"
    check_str "shipped bundle id" "$BUNDLE_ID" "__APP_ID__"
  fi
fi

[ $fail -eq 0 ] && echo "BRAND-PROOF PASS: every surface says __APP_NAME__"
exit $fail
