# NetTycoon — Tauri desktop build

Tento návod popisuje, jak zabalit hru do nativní desktop aplikace pomocí
[Tauri v2](https://tauri.app).

## Požadavky

1. **Rust toolchain** — [rustup.rs](https://rustup.rs)
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. **Node.js 18+** — pro `@tauri-apps/cli`
   ```bash
   # macOS přes Homebrew
   brew install node
   ```

3. **Platform-specific prerequisites:**
   - **macOS:** Xcode Command Line Tools (`xcode-select --install`)
   - **Windows:** Visual Studio 2022 Build Tools + MSVC v143 + Windows 11 SDK
   - Více: <https://tauri.app/start/prerequisites/>

## První spuštění

```bash
# 1) Stáhni lokální PixiJS (jinak se hra pokusí o CDN fallback)
bash vendor/fetch.sh          # macOS/Linux
# NEBO
npm run vendor:fetch:win      # Windows PowerShell

# 2) Instalace Tauri CLI
npm install

# 3) Vytvoř si aplikační ikony (jednorázově)
# Varianta A) PNG už máš jako src-tauri/icons/logo.svg — spusť:
npm run icons
# → vygeneruje src-tauri/icons/{32x32.png,128x128.png,128x128@2x.png,icon.icns,icon.ico}
#
# Varianta B) bez Node: otevři src-tauri/icons/generate-icons.html v prohlížeči,
# klikni "Stáhni vše", přesuň PNG do src-tauri/icons/, a icon.ico / icon.icns
# si vytvoř online z icon.png (cloudconvert.com)

# 4) Dev běh (s auto-reloadem a otevřenými DevTools)
npm run tauri:dev

# 5) Release build pro aktuální platformu
npm run tauri:build
```

## Cross-platform buildy

### macOS universal binary (Intel + Apple Silicon)

```bash
rustup target add aarch64-apple-darwin x86_64-apple-darwin
npm run tauri:build:mac
# → src-tauri/target/universal-apple-darwin/release/bundle/dmg/*.dmg
```

### Windows MSI + NSIS installer

Buď na Windows stroji:
```powershell
rustup target add x86_64-pc-windows-msvc
npm run tauri:build:win
# → src-tauri/target/x86_64-pc-windows-msvc/release/bundle/msi/*.msi
# → src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/*.exe
```

Nebo cross-compile z macOS (experimentální) — viz [tauri docs](https://v2.tauri.app/distribute/).

## Struktura Tauri projektu

```
WebAGame/
├── index.html           ← frontend entrypoint (Tauri ho nahraje jako WebView)
├── js/ css/ vendor/     ← stávající herní assety
├── package.json         ← npm scripts + @tauri-apps/cli
├── src-tauri/
│   ├── Cargo.toml       ← Rust deps (tauri 2.x)
│   ├── tauri.conf.json  ← konfigurace okna, bundle targets, ikony
│   ├── build.rs         ← buildscript pro tauri-build
│   ├── src/
│   │   ├── main.rs      ← entry point
│   │   └── lib.rs       ← tauri::Builder + command handlery
│   ├── capabilities/
│   │   └── default.json ← permissions pro hlavní okno (v2 CSP)
│   └── icons/           ← aplikační ikony (generované)
└── .gitignore
```

## Rozšíření backendu (volitelné)

Tauri umožňuje volat Rust funkce z JS přes `@tauri-apps/api/core#invoke`.
Příklad — native file save dialog místo prohlížečového download:

1. V `src-tauri/src/lib.rs` definuj `#[tauri::command]` handler.
2. Registruj ho v `invoke_handler![greet, save_game, …]`.
3. V JS: `await window.__TAURI__.core.invoke('save_game', { json })`.

Prozatím je aplikace 100% pure-JS — Tauri je jen tenký nativní wrapper.

## Troubleshooting

- **`error: failed to run custom build command for tauri`** — chybí Rust
  toolchain nebo platform prerequisites (viz výše).
- **`icon.ico not found`** — spusť `npm run icons` nebo viz `src-tauri/icons/README.md`.
- **`Webview not initialized`** na Windows — chybí WebView2 runtime. Tauri ho
  umí bundlovat (viz `webviewInstallMode` v `tauri.conf.json`).
- **PixiJS se nenačetl v Tauri buildu** — `scripts/prepare-dist.sh` teď
  spouští `vendor/fetch.sh` automaticky, pokud vendor/pixi*.min.js chybí.
  Stačí, aby měl build-stroj online přístup k cdnjs/jsdelivr.
- **Apka bliká / restartuje se každých ~30s v dev modu** — odstraněný `touch`
  fingerprint v `prepare-dist.sh` + dedikovaný `dist-game/` to řeší. Pokud
  problém přetrvává, koukni do terminálu kde běží `tauri dev` na zprávy
  typu "file changed, reloading" a do console na `[page-load]` timestampy.

## Distribuce build-outputu kamarádovi

Tauri build produkuje instalační balíčky — `.dmg` pro macOS, `.msi` / `.exe`
pro Windows, `.AppImage` / `.deb` pro Linux. Na jakém stroji spustíš
`npm run tauri:build`, pro ten dostaneš balíček.

### macOS → build pro macOS kamaráda

```bash
# Universal binary (jede na Intelu i Apple Silicon)
rustup target add aarch64-apple-darwin x86_64-apple-darwin
npm run tauri:build:mac
```

Výsledný `.dmg` najdeš v:
```
src-tauri/target/universal-apple-darwin/release/bundle/dmg/NetTycoon_0.1.0_universal.dmg
```

Pošli kamarádovi tenhle jeden `.dmg` soubor. Otevře ho, přetáhne NetTycoon.app
do složky Applications, hotovo.

**⚠ macOS Gatekeeper** — nepodepsanou aplikaci macOS nenechá otevřít standardně.
Kamarád musí při prvním spuštění buď:
- **Systémové nastavení → Soukromí a bezpečnost → "Otevřít přesto"**
- NEBO v Terminálu: `xattr -cr /Applications/NetTycoon.app`

Tohle je dobrý text přiložit v e-mailu / Messengeru (viz `DISTRIBUCE.md`).

### macOS → build pro Windows kamaráda

Cross-compile z macOS je v Tauri experimentální. Dvě spolehlivější cesty:

1. **GitHub Actions** — push repo na GitHub, v `.github/workflows/release.yml`
   nech Tauri zbuildit pro všechny platformy najednou. Šablonu najdeš na
   <https://v2.tauri.app/distribute/pipelines/github/>.
2. **Windows VM nebo Windows stroj** — překopíruj si repo, na Windows:
   ```powershell
   bash vendor/fetch.ps1        # stáhne PixiJS
   npm install
   npm run tauri:build:win
   ```
   Výsledný `.msi` je v `src-tauri/target/release/bundle/msi/`.

### Windows → build pro Windows kamaráda

```powershell
rustup target add x86_64-pc-windows-msvc
npm install
npm run tauri:build:win
# → src-tauri/target/release/bundle/msi/NetTycoon_0.1.0_x64_en-US.msi
# → src-tauri/target/release/bundle/nsis/NetTycoon_0.1.0_x64-setup.exe
```

Pošli `.msi` (pro korporátní stroje) nebo `.exe` (Nullsoft installer) —
`.exe` je kamarádsky přívětivější.

**⚠ Windows SmartScreen** — nepodepsaná aplikace zobrazí varování
"Windows protected your PC". Kamarád musí kliknout **"More info" → "Run anyway"**.

### Předání přes web / cloud

Balíček bývá 10–30 MB (Tauri dělá malé bundly díky systémovému WebView).
Nahraj na Google Drive / Dropbox / WeTransfer a pošli odkaz. Do popisu
dej odkaz/text z `DISTRIBUCE.md`.
