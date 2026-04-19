#!/usr/bin/env bash
# Stáhne PixiJS a pixi-filters do vendor/ pro offline / Tauri build.
# Spusť z rootu repa: bash vendor/fetch.sh
set -euo pipefail
cd "$(dirname "$0")"

PIXI_VER="7.3.2"
FILTERS_VER="5.3.0"

echo "→ Stahuji pixi.js $PIXI_VER..."
curl -fsSL -o pixi.min.js "https://cdnjs.cloudflare.com/ajax/libs/pixi.js/${PIXI_VER}/pixi.min.js"

echo "→ Stahuji pixi-filters $FILTERS_VER..."
curl -fsSL -o pixi-filters.min.js "https://cdn.jsdelivr.net/npm/pixi-filters@${FILTERS_VER}/dist/browser/pixi-filters.min.js"

echo "✓ Hotovo. Soubory:"
ls -lh pixi.min.js pixi-filters.min.js
