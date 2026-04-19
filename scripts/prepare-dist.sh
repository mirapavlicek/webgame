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

# SVG loga + favicon (pro PWA manifest + Tauri)
mkdir -p "$DIST/src-tauri/icons"
for f in src-tauri/icons/favicon.svg src-tauri/icons/logo.svg; do
  [ -f "$f" ] && cp "$f" "$DIST/src-tauri/icons/" || true
done

# NEtouchovat fingerprint soubor — každý `touch` může v macOS dev modu
# zbytečně probudit Tauri watcher a způsobit reload.
echo "✓ dist-game/ připraveno ($(du -sh "$DIST" | cut -f1))"
