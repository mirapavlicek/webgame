# AGENTS.md

## Cursor Cloud specific instructions

NetTycoon is a **100% client-side browser game** (Czech ISP tycoon, HTML5 canvas
isometric rendering + optional PixiJS/WebGL FX). There is **no backend, no
database, and no docker**. It is also packaged as an optional Tauri v2 desktop
wrapper, but the Rust side is just a window shell with no app logic.

Two front-end versions coexist:
- `index.html` — v1 (default, feature-complete); loads global scripts from `js/*.js`.
- `index_v2.html` — v2 in-progress ESM rewrite under `src/` (see `MIGRATION-ESM.md`).
The Tauri build bundles v1 (`index.html`).

### Running the game (primary dev workflow)
The game uses ES modules + WebGL, which browsers block over `file://`. You MUST
serve it over HTTP — do not open `index.html` directly. From the repo root:

```bash
python3 -m http.server 8765 --bind 127.0.0.1
# then open http://127.0.0.1:8765/index.html  (v1)
#       or http://127.0.0.1:8765/index_v2.html (v2 ESM)
```

Port `8765` is the project convention (`start.command`, README); any static
server / port works. Game state persists in browser `localStorage`.

### Tests
`npm test` runs plain Node scripts in `tests/` (no test framework, no deps). They
require no server and no install.

### Lint
There is no lint setup in this repo (no ESLint/config). Automated checks = `npm test`.

### Optional: PixiJS WebGL effects
`bash vendor/fetch.sh` downloads PixiJS into `vendor/` (gitignored). The game
degrades gracefully and falls back to CDN if these are missing, so FX are never
blocking.

### Optional: Tauri desktop (`npm run tauri:dev` / `tauri:build`)
Not needed for browser development. Requires the Rust toolchain plus Linux WebKit
system libraries (e.g. `webkit2gtk-4.1`) which are not part of the standard
environment; only set those up if you specifically need to build/run the desktop
app.
