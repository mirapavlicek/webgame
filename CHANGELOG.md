# Changelog

Všechny podstatné změny v NetTycoonu jsou zdokumentované v tomto souboru.

Formát vychází z [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
verzování podle [SemVer](https://semver.org/spec/v2.0.0.html).

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
