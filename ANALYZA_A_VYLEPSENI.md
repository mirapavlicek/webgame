# NetTycoon — Analýza a návrh vylepšení

Datum: 2026-04-18

Tohle je technicko-designový audit současného stavu a konkrétní návrhy, kam hru posunout. Rozděleno na tři části: (1) grafika a vizuální pocit, (2) gameplay a funkční mechaniky, (3) volba prostředí — zda zůstat v prohlížeči, nebo přejít jinam.

---

## 1. Současný stav — shrnutí toho, co hra má

Co funguje dobře:
- Modulární struktura JS (konstanty, stav, mapa, kapacita, WiFi, události, render, akce, UI, input, main).
- Poctivě hluboká simulace: per-building zákazníci, citlivost na cenu, vytížení DC, výpadky, WiFi dosah, migrace zákazníků mezi propojenými DC.
- Isometrický render s day/night cyklem, částicemi na kabelech, blikajícími okny v budovách podle deterministického hashe, stíny, minimapa.
- Propojení DC přes trasu kabelů (sdílená kapacita, failover při výpadku).
- Zpětná kompatibilita ukládacích souborů.

Kde hra vázne:
- **Vizuál** je čistě čárová geometrie (`ctx.moveTo/lineTo`), žádné textury ani sprity. Interface je hustě nabitý, drobné písmo (7–10 px).
- **Gameplay po ~6. měsíci se zacyklí** — cyklus „postav DC → natáhni kabely → uprav tarif". Chybí vnější tlaky (konkurence, regulace, události nad rámec výpadků).
- **Globální scope + pořadí `<script>` tagů** znamená křehké přejmenování a skryté závislosti.
- **Přepočet kapacity ~3× za frame** je brzda už teď; větší mapy to rozbijí.
- **UI má 9 záložek** a nákup vybavení = tab → modal → položka → potvrzení. Tření odrazuje od experimentování.

---

## 2. Grafická vylepšení

Tady jsou návrhy seřazené od nejmenšího zásahu po největší. Dají se kombinovat.

### Level 1 — kosmetika bez zásahu do architektury
- **Sprity místo čár.** Vykreslit si jednou sadu pixel-art nebo SVG tilů (střecha budovy, rack, stožár, anténa) do off-screen `<canvas>` a pak je `drawImage`-ovat. Okamžitě zvedne produkční hodnotu o tři stupně a zlevní render, protože `drawImage` je řádově rychlejší než stovky `fill`/`stroke` volání.
- **Výraznější zpětná vazba.** Když zákazník odejde kvůli ceně, ať z budovy vyletí červené „−1". Výpadek DC = tmavá budova + ikonka blesku. Upgrade vybavení = krátký shine přes rack.
- **Lepší typografie a rozestupy v UI.** Font zvednout na 11–12 px, přidat padding v postranním panelu, nadpisy 13–14 px. Teď je to „Excel-like".
- **Animované přechody.** Místo skoku kamera plynule zoom/pan (lerp), otevření modalu `transform: scale(0.95)` → `1` za 150 ms. Levné, pocit úplně jiný.
- **Night/day přechod** rozšířit o barvy světel v oknech (teď svítí stále), pouliční lampy podél kabelových cest.

### Level 2 — parralelní render layer
- **Oddělit statickou vrstvu mapy od dynamické.** Terén + budovy + kabely překreslovat jen když se změní (flag `dirty`). Částice, animace, kurzor = overlay canvas. Úspora 40–70 % kreslení.
- **Frustum culling.** Vykreslovat jen tiles ve viewportu + margin. Render.js to teď v podstatě neumí.
- **Heatmapa zátěže** jako volitelný overlay (F1–F4 hotkeys): vytížení DC / kvalita signálu WiFi / cena/Mbps v dané oblasti / spokojenost.
- **Parallax pozadí** (obloha, vzdálené hory) za isometrickou scénou — dodá hloubku.

### Level 3 — přechod na WebGL / 3D
- **PixiJS** (WebGL 2D) je drop-in, zachová isometrii a nabídne bezplatný batching, filtry (glow, blur) a partikly. Port by znamenal přepsat `render.js` (~600 řádek), ostatní logika beze změn. Zhruba 2–4 dny práce.
- **Three.js / Babylon** pro pravé 3D je ambicióznější (1–2 týdny), ale získáš dynamické osvětlení, stíny, kameru s náklonem — hra by vypadala jako mini Cities: Skylines. Cena: vlastní 3D modely, víc paměti, složitější debug.
- **Svg ikonografie** v UI (Lucide, Phosphor) místo unicode — profi vzhled v menech.

### Konkrétní quick win (cca půl dne):
Vytvořit sprite atlas s ~15 základními budovami + 4 typy DC + 3 typy stožáru + ikonou výpadku → nahradit `drawBldg`, `drawDC`, `drawTower` voláním `drawImage`. Výsledek bude bez přehánění jiná hra.

---

## 3. Funkční / gameplay vylepšení

Problém po 6. měsíci: simulace je granulární, ale není **emergentní** — nic nečekaně nenastane, zákazníci spolu neinteragují. Tady jsou mechaniky, které přidávají hloubku, ne komplexitu:

### A) Konkurence (stub už v `state.js:89` existuje)
- 1–3 AI konkurenti, kteří staví vlastní DC, shánějí zákazníky, snižují ceny. Vizuálně jinou barvou. Hráč je vidí na mapě i v tabulce tržního podílu.
- Mechanika cenové války: když konkurent jde níž o 15 %, odpadne 5–20 % zákazníků podle smluvních závazků.
- Akvizice: lze konkurenta koupit, když má dluh.

### B) Kontrakty a B2B
- Nabídky od velkých firem (nemocnice, škola, průmysl) se specifickým SLA: 99.9 % uptime, ≥500 Mbps, garantované odpovědi. Porušení = penále. Platí hodně. Přiblíží to pocit „opravdového ISP".

### C) Události nad rámec výpadků
- Bouře, která poškodí kabely v sektoru (opravit fyzickou návštěvou, stojí čas/peníze).
- Stavební práce ve městě → nutnost přeložit kabely.
- Viral růst (video o městě) → náraz poptávky.
- Regulační zásahy: cenový strop, povinné neutralita, povinné krytí.
- Kyberútok — DDoS, potřeba mitigace v DC.

### D) Personál a HR
- Stávající „marketing/sales staff bonus" jen jako koeficient. Rozvinout: najmout technika, správce, bezpečáka, každý s úrovní (junior/senior) a mzdou. Nedostatek = pokles kvality služeb.

### E) Technologické stromy a éry
- Hra začíná v roce 2005 (ADSL), postupem času se odemyká VDSL → FTTH → 5G → 6G. Staré technologie stále fungují, ale zákazníci je opouštějí.
- Výzkum jako slot (podobně jako vybavení v DC).

### F) Mapa a rozšiřování
- Víc měst / regionů na jedné kampani. Mezi nimi páteřní linky (drahá investice, velká návratnost).
- Volitelný sandbox vs. kampaň se scénáři („Obnov ISP po povodni", „Pokryj venkov za 3 roky").

### G) UX opravy, které nejsou „jen kosmetika"
- **Quick-buy z kontextového menu** nad budovou / DC. Zruší 3-click flow.
- **Notification feed** s filtrem (výpadky / zákazníci / finance / konkurence). Teď se občas ztrácí info.
- **Graf cashflow** (měsíčně, 12 měsíců zpětně) místo prostých čísel.
- **Návod / tutorial** pro prvních 10 minut. Hra má 60+ interaktivních prvků — bez tutoriálu vysoké odrazení.
- **Varování před krachem** — když výdaje > příjmy a zůstatek < 3 měsíce runway.
- **Undo** posledních 30 s akcí (nechtěně smazaný kabel).

### H) Technický dluh, co brzdí další vývoj
- Přejít na ES modules (`type="module"`). Vyřeší globální scope a nejasné závislosti. ~1 den práce.
- Cache kapacity s `dirty` flagem — přepočítávat jen při změně topologie / tarifů, ne každý frame.
- Oddělit doménovou logiku (simulace) od renderu a UI do čistých modulů. Pak je port na jiné prostředí reálný.
- Uložené hry migrovat přes verzovaný schéma, ne přes řadu `if (!G.x) G.x = ...`.

---

## 4. Prostředí — zůstat v prohlížeči, nebo jít jinam?

Krátká odpověď: **prohlížeč nech jako hlavní cíl, ale zabal ho do desktopové obálky (Tauri/Electron)**. Nativní engine (Godot/Unity) by dával smysl jen při přepisu od nuly s ambicí skutečného 3D.

Srovnání reálných možností:

**Zůstat v prohlížeči (status quo)**
- Plus: nulová instalace, snadný update, sdílení linkem, Mac/Win/Linux zadarmo.
- Minus: stropy výkonu u velkých map, omezený přístup k souborům (teď saveluje přes FileReader/Blob), těžké monetizovat bez backendu.

**Tauri (doporučeno)**
- Webview + Rust shell. Výsledný installer ~5 MB (Electron má 150 MB).
- Pravá práce se soubory (`fs` API), lokální saves bez download dialogů, tray ikonka, auto-update.
- Kód zůstane stejný, jen pár API přepnout. **Odhad: 2–4 dny.**
- Distribuce přes Steam / itch.io je reálná.

**Electron**
- To samé co Tauri, ale těžší (Node.js bundle). Volit jen když chceš Node knihovny přímo v rendereru.

**Capacitor (mobil)**
- Canvas přežije, ale UI se 9 záložkami se na 375px šířku nevejde. Chtělo by to redesign — sheet bottom panels, touch-friendly tlačítka. **Odhad: 2 týdny jen na UI.**

**Godot 4 / Unity**
- Reálná hra postavená jako produkt: skutečná 3D scéna, shadery, audio engine, snadný port konzolím.
- Cena: přepsat všechno (3–6 měsíců jednoho vývojáře). Simulace v `capacity.js` se dá portovat jedna k jedné do GDScript/C#, ale render, UI, input od nuly.
- Volit, pokud cíl je „vydávaný hratelný produkt". Pro dobrou webovou hru to overkill.

**PWA (Progressive Web App)**
- Levný mezikrok: manifest.json + service worker → instalace „jako appka" na desktop i mobil, offline běh. Pár hodin práce. **Doporučuju udělat hned** jako první krok, než řešit Tauri.

### Moje doporučení (pořadí kroků):

1. **Týden 1** — technický úklid: ES modules, cache kapacity, PWA manifest + service worker. Tím se zbavíš 80 % současných brzd.
2. **Týden 2** — sprite atlas + quick-buy + heatmap overlay. Okamžitý skok v produkční hodnotě.
3. **Týden 3–4** — konkurence (AI ISP) a kontrakty B2B. Tady hra přestane být „zahradničení v tabulce" a stane se hrou.
4. **Týden 5+** — Tauri build pro desktop distribuci. Volitelně port na PixiJS pro shadery/glow.

Až tenhle milník splníš a hra bude zábavně hratelná hodinu+ v kuse, teprve pak má smysl uvažovat o Godot portu s 3D.

---

## 5. Rychlý seznam bugs / risks, co jsem u checku zahlédl

- `calcCapacity()` se volá ~3× za frame → caching bude největší win.
- `JSON.stringify/parse` v save/load neunese funkce (`generatedContracts` potřebují rekonstrukci, `state.js`).
- Polykané chyby v `monthUp` (try/catch → console) — hráč se nedozví, když se něco rozbije.
- Žádné cleanup pro odstraněné kabely/stožáry → memory leak na dlouhé hře.
- Hardcodované magic numbers (mapa 40, TW/TH, speed 0–5) — chtělo by `config.js`.

---

Pokud chceš, můžu jako další krok:
- udělat sprite atlas a přepnout `drawBldg/drawDC` (nejvyšší viditelný dopad),
- udělat cache kapacity a ES modules (nejvyšší dopad na výkon a udržovatelnost),
- načrtnout mechaniku AI konkurence a implementovat prototyp,
- nebo rovnou zabalit projekt do Tauri a dát ti hotový instalátor.

Stačí říct, kam skočit.
