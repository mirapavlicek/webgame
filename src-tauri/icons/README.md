# icons/ — aplikační ikony

V tomhle adresáři jsou:

- `logo.svg` — hotové vektorové logo NetTycoon (512×512, izometrická síť + DC + fiber).
- `favicon.svg` — menší čistá varianta (64×64) pro favicon / taskbar.
- `generate-icons.html` — jednostránkový generátor, který z `logo.svg`
  vyrenderuje všechny Tauri velikosti PNG přímo v prohlížeči.

## Rychlý start (bez Node)

1. Otevři `generate-icons.html` v prohlížeči (Chrome/Safari).
2. Klikni **Stáhni vše** — stáhne ~15 PNG (32, 128, 128@2x, 512, Square*).
3. Přesuň stažené PNG sem (`src-tauri/icons/`).
4. `icon.ico` (Windows) a `icon.icns` (macOS) vytvoř z `icon.png`:
   - online: cloudconvert.com / icoconvert.com
   - nebo: `npx @tauri-apps/cli icon icon.png` (Node varianta níže).

## Vygenerování ikon přes Tauri CLI (alternativa)

1. Připrav zdrojový PNG minimálně 1024×1024 px (doporučeno): uložte jako
   `vendor/icon-source.png` (nebo kamkoliv).
2. Spusť z rootu repa:

   ```bash
   npx @tauri-apps/cli icon vendor/icon-source.png
   ```

   (nebo přes npm script: `npm run icons`)

Tauri CLI automaticky vygeneruje a umístí do `src-tauri/icons/`:

- `32x32.png`
- `128x128.png`
- `128x128@2x.png`
- `icon.icns` (macOS)
- `icon.ico` (Windows)
- `Square30x30Logo.png`, `Square44x44Logo.png`, … (Windows Store, volitelné)

## Před prvním buildem

Bez ikon Tauri build selže. Buď si vygeneruj vlastní (viz výše), nebo si
stáhni default ikony z Tauri init templatu:

```bash
curl -O https://raw.githubusercontent.com/tauri-apps/tauri/dev/examples/api/src-tauri/icons/icon.png
npx @tauri-apps/cli icon icon.png && rm icon.png
```
