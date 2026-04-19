# Changelog

Všechny podstatné změny v NetTycoonu jsou zdokumentované v tomto souboru.

Formát vychází z [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
verzování podle [SemVer](https://semver.org/spec/v2.0.0.html).

## [0.3.1] — 2026-04-19

Minor update zaměřený na obnovitelné zdroje energie. Hráč teď může aktivně
ovlivňovat svůj účet za elektřinu stavbou vlastních elektráren.

### Added

#### ☀️ Obnovitelné zdroje energie (`js/renewable.js`)
- 4 typy outdoor elektráren stavitelných na zelené dlaždici:
  - 🌞 **Solární panel** — 450 000 Kč, ~3 kW průměr, léto ×1,4 / zima ×0,5.
  - 🔆 **Solární farma** — 1 800 000 Kč, ~12 kW, velkoplošná.
  - 💨 **Větrník** — 900 000 Kč, ~6 kW, sezónně stabilnější (zima ×1,15).
  - 🌀 **Větrný park** — 3 500 000 Kč, ~25 kW průměr.
- Dlaždice s elektrárnou blokuje auto-zástavbu (domy/firmy se nespawnují).
- Produkce se v monthly tick odečítá od spotřeby DC (IT×PUE×730h).
- Přebytek se prodává do sítě za ⅓ aktuální spot ceny (`SURPLUS_SELL_RATIO`).
- Roční degradace −0,8 %/rok (napojení na celkovou #8 HW aging filozofii).
- Sezónní faktory: solar cos-křivka s peakem v červenci, wind s peakem v lednu.

#### 🌞 eq_solar_roof — solární panely na střechu DC
- 150 000 Kč, +2 kW průměrná produkce (sezónní faktor solar).
- Žádná extra plocha, kompenzace účtu v DC.
- Instalovatelné přes Tech tab → „Solární panely (střecha)".

### Changed

- `main.js` monthUp: pokud existují elektrárny nebo DC solar, používá
  `totalMonthlyElectricityCostNet()` (netto účet po odečtu produkce) místo
  starého `totalMonthlyElectricityCost()`. Přebytek se přičítá k `inc`.
- `actions.js` expandMap: `G.powerPlants` se shiftují spolu s ostatními
  entitami při rozšiřování mapy.
- Spawn budov v `map.js`, `main.js`, `events.js`, `actions.js` respektuje
  `hasPowerPlant(x,y)` — žádná auto-zástavba na tiles s elektrárnou.

### Technical

- Nový save field `G.powerPlants:[]`, `G.renewableSurplusRevM`, `G.renewableMaintM`.
- Migrace v `state.js handleLoad()` — staré savy se dohrají bez pádu.
- `render.js` — `drawPowerPlant(x,y,pp)` kreslí izometrické panely/turbíny,
  větrné turbíny mají animované lopatky (sin-wave rotation).

## [0.3.0] — 2026-04-19

Další velký balík „reálné ekonomiky". Cílem bylo zavést 6 nových systémů,
které dělají z NetTycoonu věrnější simulaci provozu českého ISP: spotová
cena elektřiny + PUE, segmentace zákazníků, rozdělení peněžního toku od
ziskovosti, hierarchie peeringu (NIX.CZ + globální transit), HW stárnutí
a regulační šoky (ČTÚ, NIS2, GDPR).

### Added

#### #1 Elektřina a PUE
- Spotová cena elektřiny se pohybuje sezónně (zima × 1,25, léto × 0,85),
  odchylka ±20 % měsíčně. Bázová cena 4,5 Kč/kWh (2010) + inflace.
- Každé DC má vlastní PUE (1,25–1,8 podle typu chlazení a úrovně), spotřeba
  se násobí PUE × kW ze zařízení.
- Investice do chladiče (`eq_cooling_premium`) sníží PUE o ~0,25.
- Měsíční nákladová položka „⚡ Elektřina" ve finančním přehledu.

#### #3 Segmentace zákazníků
- 5 segmentů: **residential** (domácnost), **soho** (malá firma), **smb**
  (střední firma), **enterprise** (korporace), **government** (veřejný sektor).
- Každý segment má: ARPU multiplier (1× až 3,5×), SLA floor, citlivost na
  cenu vs. kvalitu, měsíční churn baseline.
- B2B segmenty (SMB/Enterprise/Gov) platí 2–3,5× víc za stejný tarif, ale
  odejdou rychleji při výpadku. Residential je cenově citlivější.
- Nový dashboard „👥 Segmenty zákazníků" v záložce Obchod.

#### #6 Cash flow ≠ profit
- Nové účty `G.capexM`, `G.opexM`, `G.ytdCapex`, `G.ytdOpex`,
  `G.pastCapexPool`, `G.capexLog`, `G.opexBreakdownM`.
- CapEx (DC, kabely, věže, equipment, IXP, peering) se automaticky
  zaznamenává přes `recordCapex()` a amortizuje 60 měsíců (D&A).
- OpEx rozložený na kategorie: salaries, electricity, transit, hw_maintenance,
  cloud_ops, customer_ops.
- **Faktoring**: prodej N měsíců budoucích tržeb za 88 % × N × měsíční tržba
  upfront. Jednoduchá varianta — faktor bere 100 % tržeb po dobu N měsíců.
- **Dotace a granty**: 5 šablon (EU rural fiber 60 %, ČTÚ 5G 45 %,
  Smart City 35 %, MPO datacentra 30 %, NKP školství 50 %). Po přijetí se
  účelově váže na CapEx a po splnění podmínek vyplácí refund.
- Panel „📈 Cash Flow vs. Profit" v Mgmt → Finance ukazuje rozdíl mezi
  provozním cash flow a účetním ziskem.

#### #7 Peering hierarchie
- **NIX.CZ peering** (IXP level 1–3): sníží transit cenu o 15–25 %, větší
  latence zlepšení mezi českými cíli, poplatek 80–260 tis. Kč/měs.
- **Transit kontrakty**: 4 globální providery (Cogent, Lumen, Telia, NTT),
  každý s jinou cenou/Mbps, SLA, RTT. Bez transitu omezená kapacita DC.
- Každé DC dostane BW bonus od aktivního transit kontraktu.
- Nová sekce „🌐 Transit" v záložce Cloud.

#### #8 HW stárnutí
- Každý kus eq má install date; měsíční kontrola pravděpodobnosti selhání.
- Staré HW má vyšší šanci výpadku (křivka se dramaticky zvedá po 5–7 letech).
- Prevence: pravidelný replace v DC detailu.

#### #9 Regulační šoky (ČTÚ, NIS2, GDPR)
- Max 1 regulační událost za 2,5 roku (`REGULATORY_MIN_MONTHS_BETWEEN=30`),
  pravděpodobnost ~18 % ročně. Hráč má vždy 3 měsíce na rozhodnutí
  ze 3 možností (compliance / middle ground / ignore).
- **ČTÚ cenová regulace**: povinné −15 % na residential tarify na 36 měsíců,
  nebo pokuta 1,2 mil. Kč, nebo odvolání (50/50).
- **NIS2 audit** (od 2024): firewall v každém DC + cybersec tým do 6 měs,
  nebo 600 tis. Kč konzultant, nebo 10 mil. Kč pokuta + −20 reputace.
- **GDPR incident** (od 2018): pokuta 0,5 % nebo 4 % roční tržby podle
  strategie (cooperate / minimize / deny).
- **Spektrum licence** (5G/LTE): jednorázový poplatek 500k–1,5M Kč, jinak
  věže po 3 měsících vypnuty.
- Nový panel „🏛️ Regulace" v Mgmt → Finance.

### Changed

- `calcBldRevenue` nyní zohledňuje segment ARPU multiplier a ČTÚ cenovou
  regulaci (pokud aktivní).
- Měsíční výdaje rozšířeny o transit cost a elektřinu (PUE × kW).
- `monthUp()` nyní volá: `subsidiesMonthlyTick`, `segmentMonthlyChurnTick`,
  `regulatoryMonthlyTick`, `cashflowMonthlyClose`.
- `actions.js` — po každé nákupní transakci (DC, kabel, věž, eq, junction,
  IXP, peering) volá `recordCapex()` pro sledování investic.

### Notes

- Save kompatibilita: všechny nové pole mají migraci v `state.js handleLoad()`,
  staré savy se dohrají bez pádu.
- Balancované kulturní nastavení: regulační události nejsou náhodné tragédie,
  hráč je vždy upozorněn a má smysluplnou volbu.
- IPv4 broker (původně bod #10) odložen na v0.4.0.

## [0.2.0] — 2026-04-19

Velký balík ekonomických a AI úprav. Cílem bylo dostat hru blíž k realitě
českého ISP trhu — propagace inflace do všech cenotvorných kanálů, aktivnější
AI konkurence, hlubší cloud business model, opravy síťového routingu a nové
startovní režimy.

### Added

#### Ekonomika — inflace a valorizace cen
- Nová inflační osa `G.tariffInflation` (valorizační doložka) — roste rychleji
  než mzdy a HW (≈ 0,5–0,7 × CPI/rok), modeluje, jak reální ISP přenášejí
  zdražení energie, HW a podpory do koncové ceny.
- `inflTariffPrice(n)` helper pro konzistentní aplikaci tarifní inflace.
- UI status baru ukazuje i tarifní inflaci: `CPI +X% (mzdy +Y% · HW +Z% · tarify +W%)`.
- Tabulka tarifů:
  - Info banner „📈 Valorizační doložka +X %".
  - U každého řádku efektivní tržba se šipkou `↑X %` a tooltip s nominální hodnotou.
  - Cenová reference se srovnává s efektivní cenou (ne s nominálem).

#### AI konkurence
- **Marginal-cost-plus-margin pricing model** — AI už nekopíruje cenu hráče,
  ale počítá `marginalCost / (1 − targetMargin)` jako podlahu.
  - Marginální náklad: 20 Kč (mzdy × `salaryInflation`) + 18 Kč (HW × `componentInflation`),
    modifikováno strategií (premium ×1,2 / balanced ×1,0 / budget ×0,85).
  - Cílové marže: premium 28 %, balanced 18 %, budget 10 %.
- **`pricingMood` konečně funkční** — reaguje na minulou marži:
  - < 70 % cíle → zvedá cenu +3 %,
  - \> 140 % cíle → srazí −3 %.
- **Per-konkurent tarifní inflace** — každý AI zdražuje vlastním tempem
  (`tariffFactor × CPI × šum ±15 %`). Někteří agresivně, jiní opatrně.
- **Kapacitně řízená expanze** — místo čistě náhodné stavby na základě cash
  teď AI sleduje `capacityPressure = customers / capacity`. Nad 80 % tlačí
  expanzi (45 % roll místo 12 %), nad 85 % brzdí i onboarding nových zákazníků.
- Nová pole v AI objektu: `strategy`, `avgPrice`, `pricingMood`,
  `tariffInflation`, `targetMargin`, `lastMonthMargin`.

#### Cloud business model
- Každá cloud služba má vlastní `mCost` (provozní náklad na instanci,
  ≈ 18–22 % ceny) — VPS, K8s, DBaaS, S3 a storage mají odlišné marže
  (GPU a HA databáze stojí nejvíc na provoz, S3 nejmíň).
- `calcCloudOpCost()` — reálný provozní náklad se odečítá z hotovosti každý měsíc,
  dev staff automatizuje až −30 % (2 %/dev + XP level + 10 % upgrade `auto1`).
- `calcCloudMargin()` — UI helper vracející `{rev, cost, profit, marginPct}`.
- Reputační systém `G.cloudReputation` (0–100, start 60):
  - Drift +0,12/den stabilní, −2,5/den výpadek, −0,4/den chybějící HW.
  - Pod 40 spirála churnu, pod 20 druhá vlna.
  - Ovlivňuje poptávku (`repFactor 0,35–1,25×`) i cenu (±5 % / −20 %).
- Reálné SLA kredity — `G.cloudOutageDaysM` sleduje dny porušení SLA v měsíci,
  kredit narůstá až `3 × penaltyPct` podle překročení smluvního uptime.
- Marketing/support/dev cross-effects:
  - Marketing milestones (marketing1/2/3 + brand1/2) přidávají plošně k cloud poptávce.
  - Support staff snižuje churn (až −35 %) a zvedá spokojenost.
  - Dev staff snižuje cloud opCost.
- Konkurenční tlak `compPressure` (odvozený od síly konkurentů) zmenšuje cloud TAM.
- Kapacitní brzda — nad 85 % využití se poptávka drasticky brzdí, nad 95 % stop (waitlist).
- Cloud list-price bere `max(tariffInflation, 0,9 × componentInflation)` — list-price
  nikdy nespadne pod 90 % HW nákladů.

#### BGP diagnostika a routing
- Nový `bfsCablePath(sx,sy,ex,ey,avoidSegs)` — BFS, která traversuje jen segmenty
  s reálně natáhnutým kabelem (gate na `segLoads[key].max > 0`), ne pouze silnice.
- `diagDCPath(i,j)` vrací strukturovaný status `linked | noRoadPath | cableGap | sameDC`.
- UI BGP sekce teď vypisuje všechna ostatní DC s per-pair diagnostikou, ne jen
  existující peerings.

#### Startovní režimy
- **HACK MíraNet** — pojmenování firmy `MíraNet` při zakládání dá startovní
  hotovost 500 000 000 Kč místo standardních 500 000.
- **HARD režim** — zaškrtávátko v new game modalu → hra začíná s úvěrem
  500 000 Kč / 10 % p.a. / 60 měs. (`hard-start` loan product).

#### Morálka zaměstnanců
- Funkce `getMoraleThreshold()` — práh stability závisí na rozpočtu školení
  (+0,1 za každých 1 000 Kč/hlavu, cap +0,8).
- Symetrický model kolem prahu místo pevných intervalů:
  - `< threshold × 0,5`: +5,
  - `< threshold × 0,8`: +3,
  - `≤ threshold`: 0 (optimum),
  - `≤ threshold × 1,5`: −3,
  - `≤ threshold × 2,5`: −6,
  - jinak: −10 (burnout).
- `G._moraleThreshold` persisten pro UI tooltips.

### Changed

- `calcBldRevenue(b)` — násobí výstup `tariffInflation` (valorizovaná koncová cena).
- `calcCloudRevenue()` — používá `max(tariffInflation, 0,9 × componentInflation)` místo čisté `componentInflation`.
- Per-customer support (25 Kč/zák./měs) teď prochází `inflSalaryCost()` — je to primárně lidský náklad.
- AI náklady všechny přes inflaci:
  - DC údržba `6 000 × componentInflation` / DC,
  - Zákaznický support `28 × salaryInflation` / zákazník.
- AI build thresholdy: první DC `100 000 ×`, malý `250 000 ×`, velký `350 000 ×` (vše × `componentInflation`).
- AI bankrot prahy škálují inflací: soft −80 000, recover +50 000, hard −250 000 (všechny × `componentInflation`).
- Akviziční cena: `zákazníci × 4 000 × tariffInflation + DC × 200 000 × componentInflation`.
- Cartel reference „drahá cena" / „sladěné ceny" škáluje `tariffInflation`.

### Fixed

- **BGP peering routing** — původní `bfsPathAvoid` v capacity.js kontroloval
  jen `G.map[ny][nx].type === 'road'`, ale nikdy neověřil přítomnost kabelu
  na segmentu. Když hráč natáhl kabely po alternativní cestě, BFS pořád pickoval
  nejkratší (uncabled) silnici a hlásil „cable gap". Přepnuto na `bfsCablePath`.
- **Empty BGP section UI** — když `G.dcLinks` neobsahoval žádný záznam, hráč
  viděl pouze „Kapacita: 100 Gbps" bez vysvětlení. Teď se iterují všechna ostatní
  DC s per-pair diagnostikou (linked / no road path / cable gap).

### Technical

- Migrace save-game pro nová pole: `G.tariffInflation`, `G.cloudReputation`,
  `G.cloudSLACreditM`, `G.cloudOutageDaysM`, per-AI `tariffInflation`, `targetMargin`,
  `lastMonthMargin`.
- Všechny změny prošly `node --check` na 7 modifikovaných JS souborech.

---

## [0.1.0] — Initial commit

První verze NetTycoonu — Tauri v2 desktop wrapper + vanilla JS herní logika.
