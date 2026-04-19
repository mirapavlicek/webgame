#!/usr/bin/env bash
# Vytvoří čistou kopii frontend-assetů hry do dist-game/ pro Tauri build.
# Cíl: Tauri dev watcher sleduje JEN dist-game/, ne src-tauri/target/ — jinak
# nekonečný reload loop.
#
# Spusť: bash scripts/prepare-dist.sh  (nebo: npm run prepare-dist)
# Tauri to zavolá automaticky přes beforeDevCommand / beforeBuildCommand.

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DIST="dist-game"
rm -rf "$DIST"
mkdir -p "$DIST"

# Povinné runtime soubory
cp index.html "$DIST/"
cp manifest.webmanifest "$DIST/"
cp sw.js "$DIST/"
cp -R css "$DIST/"
cp -R js "$DIST/"

# Vendor — auto-fetch PixiJS když chybí (jinak by Tauri webview dostal 404 HTML
# místo JS a index.html loader by musel spadnout na CDN fallback, který v
# offline režimu taky selže).
if [ -d "vendor" ]; then
  if [ ! -f "vendor/pixi.min.js" ] || [ ! -f "vendor/pixi-filters.min.js" ]; then
    echo "→ vendor/pixi*.min.js chybí, spouštím vendor/fetch.sh..."
    if ! bash vendor/fetch.sh; then
      echo "⚠ vendor fetch selhal — hra poběží bez WebGL FX (graceful degradation)."
    fi
  fi
  mkdir -p "$DIST/vendor"
  for f in vendor/pixi.min.js vendor/pixi-filters.min.js; do
    [ -f "$f" ] && cp "$f" "$DIST/vendor/" || true
  done
fi

# Ikony pro PWA manifest + favicon + service worker cache.
# POZOR: Tauri v2 odmítne frontendDist, která obsahuje složku "src-tauri" —
# proto kopírujeme do icons/ (bez prefixu) a web soubory (index.html,
# manifest.webmanifest, sw.js) používají relativní cestu icons/...
mkdir -p "$DIST/icons"
for f in src-tauri/icons/favicon.svg src-tauri/icons/logo.svg \
         src-tauri/icons/128x128.png src-tauri/icons/128x128@2x.png \
         src-tauri/icons/icon.png src-tauri/icons/32x32.png; do
  [ -f "$f" ] && cp "$f" "$DIST/icons/" || true
done

# NEtouchovat fingerprint soubor — každý `touch` může v macOS dev modu
# zbytečně probudit Tauri watcher a způsobit reload.
echo "✓ dist-game/ připraveno ($(du -sh "$DIST" | cut -f1))"
