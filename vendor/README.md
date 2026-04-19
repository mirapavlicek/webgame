# vendor/ — lokální JS knihovny

Tato složka obsahuje knihovny třetích stran stažené lokálně, aby hra fungovala
**offline** i po zabalení do **Tauri**.

## Obsah po stažení

- `pixi.min.js` — PixiJS 7.3.2 (WebGL FX vrstva: bloom, particles, glow)
- `pixi-filters.min.js` — PixiJS Filters 5.3.0

## Jak je stáhnout

### macOS / Linux

```bash
bash vendor/fetch.sh
```

### Windows

```powershell
powershell -ExecutionPolicy Bypass -File vendor/fetch.ps1
```

## Co když knihovny nestáhnu?

Hra běží i bez nich — `index.html` má fallback na CDN (vyžaduje internet při
spuštění). Pokud `vendor/pixi.min.js` chybí, prohlížeč automaticky načte CDN
verzi. Pro **Tauri offline build** ale doporučuji stáhnout lokálně.

## Co se nenávidí s Gitem

Tyto minifikované JS soubory netřeba commitovat — fetch skript si je stáhne
znovu. Root `.gitignore` je z trackingu vynechává.
