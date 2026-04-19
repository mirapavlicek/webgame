# Migrace na ES moduly — plán

Produkční runtime (`index.html` + `js/*.js`) běží **stabilně v klasickém
globál-script režimu**. Kompletní port na ES moduly znamená ~200 mechanických
úprav a riziko, že něco přestane fungovat bez testů. Proto tahle migrace běží
**v fázích** — každá fáze je samostatně testovatelná a **reverzibilní**.

Paralelní strom `src/` už obsahuje kostru v2 ES architektury (eventBus,
gameLoop, systems/*). Tuto migraci NEMÍCHEJ s portem do `src/` — to je samostatný
projekt (nová architektura), zatímco tady jen měníme **způsob nahrávání** téhož
kódu.

## Fáze 1 — `window.*` expose (cca 1 h)

Každá funkce, kterou volá HTML `onclick`, musí být po přepnutí na `type="module"`
explicitně připojená na `window`. Udělej to dřív, než uděláš cokoliv jiného —
je to bezpečné (no-op pro klasické skripty) a odblokuje další fáze.

**Seznam funkcí k zveřejnění** (najdeš je v HTML přes `onclick="…"`):

```bash
grep -oE 'onclick="[a-zA-Z_][a-zA-Z0-9_]*' index.html | sort -u
```

Pro každou najdenou funkci přidej na konec odpovídajícího `js/*.js` souboru:

```js
// === Globální expose pro HTML handlery ===
window.zoomIn = zoomIn;
window.zoomOut = zoomOut;
// ...
```

**Trik:** místo ručního psaní lze na konec každého `js/*.js` automaticky přidat
seznam všech top-level `function` deklarací:

```bash
# jen informační
grep -oE '^function [a-zA-Z_][a-zA-Z0-9_]*' js/ui.js | awk '{print "window."$2" = "$2";"}'
```

Po této fázi **chování nemění** (klasické skripty už globály mají).

## Fáze 2 — `"type": "module"` + adresář `js/esm/`

1. Vytvoř adresář `js/esm/` a **zkopíruj** `js/*.js` do něj (NE přesun).
2. V každém `js/esm/*.mjs` přidej na začátek jeden `import` pro každý symbol,
   který soubor čte z globálu (např. `capacity.js` používá `G`, `MAP`, `BTYPES`).
3. V `index.html` přepni **jen** jeden script naráz (začni s `constants.mjs`)
   a otestuj, že hra pořád startuje.

Postupuj v pořadí závislostí (constants → state → map → capacity → …).

**Pozor na kruhové závislosti**: kapacita ↔ stát ↔ akce často vytváří cykly.
Řešení = extrahovat čistá data do `constants.mjs` a chovat se k nim jako
read-only.

## Fáze 3 — bundler (volitelné)

Po dokončení Fáze 2 běží hra přes native ES moduly z prohlížeče. Pro Tauri je to
ok. Pro produkci na web je efektivnější bundle přes `esbuild` nebo `vite`:

```bash
npm i -D vite
# vite.config.js
export default { build: { outDir: 'dist', target: 'esnext' } }
npm run dev   # hot-reload
npm run build # produkce
```

Tauri konfigurace `frontendDist` se pak ukazuje na `dist/` místo rootu.

## Fáze 4 — v2 port do `src/`

Tohle **není pokračování** fáze 3 — je to samostatný port nové architektury.
Pokud jednou bude v2 (v `src/`) dokonalý, celou „v1" v `js/` lze jedním PR
odmazat. Do té doby jsou dvě verze: `index.html` (klasické) a `index_v2.html`
(ES moduly).

## Akceptační kritéria po každé fázi

- `index.html` se otevře v prohlížeči bez chyb v konzoli
- Nová hra startuje, hráč může postavit kabel + dům připojit
- Save → reload obnoví stav
- Heatmap/sprite cache/mapa-rozšíření stále funguje

## Proč právě teď to neudělám za tebe

Bez headless testu ve skriptu (sandbox zamrzlý) nemůžu ručit za to, že port
proběhne bez regrese. Fáze 1 je bezpečná a dobrý první krok — zaber na ni ~1 h,
pak pokračuj. Pokud narazíš na konkrétní chybu v Fázi 2, pošli konzolový log.
