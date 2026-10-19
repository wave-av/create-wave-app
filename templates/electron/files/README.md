# __APP_NAME__ — Electron shell for the __APP_NAME__ desk service

Native window for the desk service (live on `:__PORT__`). The app is only a
window: it connects to `http://127.0.0.1:${__PORT_ENV__:-__PORT__}/` and boots
the deployed server entry if the service is down.

Scaffolded from `@wave-av/create-app --template electron` (proven path:
Wave Desk dist slice).

## Files

- `main.js` — BrowserWindow (frameless) + menu. Hardened
  `webPreferences`: `preload`, `nodeIntegration:false`,
  `contextIsolation:true`, `sandbox:true`.
- `preload.js` — the only bridge:
  `window.__BRIDGE__.{getVersion,openExternal,getUpdateStatus,checkForUpdates}`
  over validated ipc channels. Zero node exposure (no `process`/`require`/
  `Buffer` in the page).
- `updater.js` — electron-updater against `__FEED_URL__`. Checks only;
  downloads wait for the rollout gate and never auto-install.
- `rollout-guard.js` — staged-rollout cohort gate (`rollout.json` on the
  feed pins `{version, rollout}`). Fail-closed: any feed problem defers.
- `entitlements.mac.plist` — hardened-runtime set (JIT, unsigned executable
  memory, no library validation). Applied at sign time.
- `build/icon.icns` (+ `build/icon.png` master) — app icon slots. Replace
  both with your brand (see below) before release.
- `scripts/scratch-server.mjs`, `scripts/smoke.sh`,
  `scripts/cold-boot.sh`, `scripts/brand-proof.sh` — proofs (below).
- `test/dist-slice.test.mjs`, `test/rollout-guard.test.mjs` — contract
  tests (`npm test`).

## Build

```sh
npm install
npm start                        # dev: window against :__PORT__ (or $__PORT_ENV__)
npm test                         # contract tests
npm run dist                     # -> dist/*.dmg + dist/*.zip (arm64)
```

Signing: `npm run dist` on a box without a Developer ID cert must run with
`CSC_IDENTITY_AUTO_DISCOVERY=false` (produces a valid but unsigned build —
Gatekeeper will ask on first Finder launch; direct binary exec works).
Release builds sign with `CSC_LINK`/`CSC_KEY_PASSWORD` (or the keychain
identity via `CSC_NAME`) and notarize with `APPLE_ID` /
`APPLE_APP_SPECIFIC_PASSWORD` / `APPLE_TEAM_ID`, which is when the
hardened-runtime entitlements and `mac.notarize` take effect.

## Proofs (scratch port, never live `:__PORT__`)

```sh
npm run smoke        # dev smoke: unpacked app paints on a scratch port
npm run cold-boot    # dist proof: dmg -> mount -> shipped .app cold-boots on scratch
npm run brand-proof  # static identity assertions (name, id, feed, icons, bundle)
```

Cold-boot starts a scratch server on an ephemeral port, builds, mounts the
DMG, cold-boots the shipped `.app` with `__PORT_ENV__=<scratch>
--smoke-test`, and asserts: scratch port served, title renders,
`window.__BRIDGE__` present, no node leak, and no socket to `:__PORT__`
was ever opened.

## Updates

The feed is a static host serving, per release: `latest-mac.yml`,
`__APP_NAME__-<version>-arm64-mac.zip`, and `rollout.json`:

```json
{ "version": "1.2.3", "rollout": 0.25 }
```

Raise `rollout` 0 → 1 to widen the cohort; machines hash stably into it.
`rollout: 0` pauses without pulling the release.

## Rebranding the icon slots

Replace `build/icon.png` (1024x1024 master) with your mark, then rebuild
`build/icon.icns`:

```sh
mkdir /tmp/app.iconset
for s in 16 32 128 256 512; do
  sips -z $s $s build/icon.png --out /tmp/app.iconset/icon_${s}x${s}.png
  sips -z $((s*2)) $((s*2)) build/icon.png --out /tmp/app.iconset/icon_${s}x${s}@2x.png
done
iconutil -c icns /tmp/app.iconset -o build/icon.icns
npm run brand-proof
```
