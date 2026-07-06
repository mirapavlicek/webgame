# Changelog

Všechny podstatné změny v NetTycoonu jsou zdokumentované v tomto souboru.

Formát vychází z [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
verzování podle [SemVer](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **🔀 BGP overflow takeover.** Když je propojené DC **přes kapacitu**, BGP peer
  s volnou kapacitou **automaticky převezme nadbytek** — i nad rámec manuální
  alokace (slideru), do volné kapacity dárce a fyzického zbytku peering linky,
  s 5% headroomem (`bgpOverflowTakeover`). Funguje i s alokací 0 (nouzové
  převzetí). Peering panel ukazuje „⚡ overflow" s převzatým objemem.
- **⚡ Posílené polní load balancery.** Aktivní polní LB nově chytrým řízením
  front zvedá **efektivní kapacitu svých 4 přilehlých segmentů o +20 %**
  (`LB_SEG_BOOST`). Boost se počítá před stavbou DC-linek a routingem, takže se
  projeví všude (kapacita tras, kongesce, heatmapa). Segment sousedící s více
  LB dostane boost jen jednou; pozastavený LB neboostuje. Tooltip kabelu
  ukazuje „⚡LB", tooltip uzlu benefit vypisuje.
- **🏗️ Velký závod** — multi-tile průmyslový gigant (**2×2 pole**), vzniká
  organickým růstem města **od roku 2015** na okraji (vzácně, u velkého města).
  Náročný B2B klient:
  - vyžaduje **přípojku ≥ 10 Gbps** a **páteřní kabel (100G+) přímo u půdorysu**
    — bez páteře ho nejde připojit;
  - **páteř ze 2+ směrů = redundance a +30 % tržeb** (přepočítává se měsíčně,
    tooltip ukazuje směry napájení N/J/V/Z);
  - masivní spotřeba BW (150 % tarifu), extrémní důraz na kvalitu.
  - Anchor+annex architektura: klik/tooltip/připojení fungují z kterékoli
    dlaždice půdorysu; růst města ani události na půdorys nestaví; bourání
    v editoru odstraní celý závod.

### Fixed
- **Pevná linka jen s kabelem u budovy.** Upgrade přípojky obcházel fyzickou
  vrstvu: klient připojený přes **5G/WiFi šel „upgradovat" na optiku i bez
  kabelu** (a na WiFi bez AP v dosahu). Nově upgrade vynucuje stejná pravidla
  jako nové připojení (`connInstallRequirement`):
  - **pevné typy** vyžadují kabelovou cestu k DC (`findDC`) — bez kabelu se
    klient z 5G/WiFi převést nedá;
  - **WiFi** vyžaduje AP v dosahu + kontroler v DC;
  - **mobilní typy (LTE/5G)** ručně instalovat nelze (řídí je vysílače);
  - při převodu bezdrát → kabel se přípojka správně **přepojí na kabelové DC**
    (vč. kontroly kapacity routeru a volných portů).

### Added
- **⬜ Ploché budovy — režim kabeláže.** Tlačítko ⬜ (nebo klávesa **B**) skryje
  3D domy a nechá jen **barevné čtverce** v typové barvě se stavovou tečkou
  (zelená = připojeno, žlutá = zájemce, šedá = nezájem). Nic nepřekáží při
  tahání kabelů; navíc levnější render. Preference se pamatuje.
- **🪛 Instalační tým (`install`)** — nový typ zaměstnance (42 000 Kč/měs).
  Automaticky připojuje nepřipojené budovy **pevnou přípojkou** tam, kam dosáhne
  DC kabelem — stejně jako bezdrátový tým u WiFi. 3 přípojky/tým/měsíc,
  preferuje zájemce, respektuje router/porty/vybavení DC. Standardně instaluje
  nejrychlejší typ do 25 000 Kč dle éry (ADSL→VDSL→optika 100M→1G); dražší
  business tiery nechává na hráči. Platí materiál; při málu peněz pauza.
- **🧭 Rychlostní verze BGP routerů** — 100 Gbps bylo málo. Nově 4 tiery:
  **100G** (stávající, přejmenován), **400G** (140 k), **1T** (320 k) a
  **2.4T** (700 k). Kapacity se při více kusech sčítají (stack). Požadavky
  služeb na „BGP router" (veřejné IP, dedikované linky, colocation) splní
  kterýkoli tier (rodina `eq_bgprouter` v `EQ_FAMILIES`); do rodiny `eq_router`
  doplněny i Carrier-Max/Tera.
- **⚖️ Polní load balancery ukazují toky po směrech.** Aktivní LB na mapě
  vykresluje **animované toky do každé kabelové větve** (barva = zatížení,
  velikost/hustota teček = podíl objemu, rychlost = vytížení) — vidíš, kudy
  a kolik dat teče. Tooltip uzlu má **rozpis toků po směrech** (↑ sever,
  → východ…: použito/kapacita a %). `junctionFlowsFromSegs`/`getJunctionFlows`.
- **💧 Velká DC na vodě s vodním chlazením.** Velké DC, Mega DC a Hyperscale
  kampus lze nově stavět i **na vodní ploše**. Když stojí **celý půdorys na vodě**,
  DC získá **vodní chlazení**: PUE −0,25 (floor 1,06 → výrazně levnější elektřina)
  a **+2 jednotky chlazení** navíc (více slotů). Hover náhled hlásí „✓ 💧 vodní
  chlazení", tooltip DC ukazuje 💧 badge. Malá/střední DC na vodu nesmí.

### Fixed
- **Cloudová ekonomika — nesmyslná marže 100 %.** Náklady škálovaly jen s počtem
  instancí, ne s velikostí byznysu (20,9 M příjmů vs. 17 k nákladů). Nově
  provozní náklady obsahují **COGS ~32 % tržeb** (licence, egress, podpora)
  + fixní část za instance (`cloudOpsFormula`); marže tak i s maximální
  automatizací nepřesáhne ~84 %.

### Added
- **☁️ Správce cloudu (`cloudadmin`)** — nový typ zaměstnance (52 000 Kč/měs).
  Velká platforma ho potřebuje: **1 správce na ~250 cloud zákazníků**
  (`cloudAdminsNeeded`). Poddimenzovaný cloud má **dražší provoz (×1,35)**
  a **klesá mu reputace**; dobře obsazený se pomalu zlepšuje (cap 90).
  Zátěž správců je napojená na morálkový model.
- `tests/cloudadmin.test.js` — 15 assertů.

## [0.7.0] — 2026-07-06

Editor mapy, řídící centrum (prestiž/QoS/adresní plány), obtížnosti, nové týmy
(výjezdové čety, bezdrátový tým, modernizace přípojek), multi-tile DC + nová
generace HW, GUI vylepšení, výkon a balanční opravy.

### Added
- **⭕ Vypínač kruhů pokrytí** (WiFi/vysílače) a **☀️ světlý design** — tlačítka
  v ovládání mapy, preference se pamatují (localStorage).
- **Multi-tile datová centra** — 🏯 **Mega DC** (2 pole: 64 slotů, 50 Gbps) a
  🏰 **Hyperscale kampus** (2×2 pole: 128 slotů, 200 Gbps). Umisťování validuje
  celý půdorys; výběr/demolice/kabely/BFS fungují z kterékoli dlaždice půdorysu.
- **Nová generace hardwaru:** kabely **1.6T/3.2T**, switche **96p/šasi 256p**,
  routery **Carrier-Max (250)/Tera (600 přípojek)**, transity **+1.6T/+3.2T**.
- **📶 Bezdrátový tým (`wifi`)** — nový typ zaměstnance. Automaticky připojuje
  **nové domy přes WiFi** v dosahu AP (`wifiTeamMonthlyConnects` ≈ 4 domy/tým/měsíc,
  preferuje zájemce, platí materiál conn_wifi, pauza při málu peněz).
- **Výběr obtížnosti při založení firmy** (`js/difficulty.js`) — 🙂 Normál
  (výchozí) / 😰 Heavy (×0,65 růst, ×1,6 poruchy, ×1,5 náklady) / 💀 Hardcore
  (**1,33× tvrdší než Heavy**: ×0,53 / ×1,80 / ×1,67).
- **🛰️ Řídící centrum (NOC) — nová nadstavba hry** (`js/controlcenter.js`).
  Grafické velení nad sítí v modálu (tlačítko 🛰️ nebo štít v liště):
  - **Prestiž providera (0–100)** — reputace řízená funkčností sítě (uptime,
    kongesce, spokojenost, dostatek IP, QoS). Udržíš-li síť funkční, **roste**;
    při výpadcích a přetížení **klesá**. Prestiž mírně ovlivňuje růst zákazníků
    (`prestigeGrowthMultiplier` 0,9–1,15). V horní liště je barevný ukazatel 🛡️.
  - **QoS politika** (Bez QoS / Řízené / Přísné) — aktivní řízení provozu tlumí
    dopad kongesce na růst za měsíční poplatek na DC (`qosCongestionFactor`).
  - **Adresní plán (IP)** — přehled využití IP adres (přípojky + věže + AP vs.
    koupené bloky), varování při docházení adres (`addressingPlan`).
  - Přehled bezdrátu a **seznam aktivních incidentů** s odkazem na řešení.
- **Výjezdová četa (`field`)** — nový typ zaměstnance (🚐). Technické týmy
  **automaticky opravují přerušené trasy** (kabelové řezy) v terénu bez nutnosti
  ručně reagovat na každý incident. `fieldCrewRemedy`:
  - kabelové řezy opravují rychle (7 bodů/den/četa, strop 28), u ostatních
    incidentů jen asistují (2/den, strop 8);
  - efekt se přičítá k dennímu progresu incidentů (vedle NOC).
- **Program modernizace přípojek** — plynulý **hromadný upgrade** přípojek prováděný
  zaměstnanci (výjezdové čety + technici). Přepínač v HR panelu; po zapnutí čety
  každý měsíc zmodernizují několik **nejpomalejších drátových přípojek** o stupeň
  výš (`nextWiredUpgrade` — nejbližší rychlejší typ dostupný v éře), v rámci
  rozpočtu (2 přípojky/měs na osobu) a placeného materiálu. Při nedostatku hotovosti
  se program pozastaví. Bezdrát/WiFi se neupgraduje (řídí věže/AP).

#### 🛠️ Sandbox editor mapy (`js/editor.js`)
- Volný editor ve 2D izometrii (klávesa **E** nebo tlačítko 🛠️ Editor): malování
  terénu (tráva/silnice/voda/park), pokládání a bourání budov — bez peněz, bez limitů.
- Klik i **tažení** maluje po dlaždicích; **hover náhled** ukazuje barvu podle nástroje.
- Čas se v editoru automaticky **pozastaví** (a po vypnutí obnoví předchozí rychlost).
- Plovoucí paleta dole uprostřed s terénem, všemi typy budov a gumou.

#### 🧭 Přehlednější GUI
- Horní lišta nově ukazuje **zákazníky (🔌)** a **průměrnou spokojenost (😊/😐/😟)**
  barevně — rychlý přehled bez otevírání panelů.
- Záporná hotovost se v liště zvýrazní červeně.

### Changed
- **Výpadek už nevynuluje příjmy.** Fakturace je měsíční, takže výpadek se
  neprojeví okamžitou ztrátou celého příjmu. Místo toho se podle **délky výpadku**
  zákazníci **mohou i nemusí dožadovat vrácení části tarifu** (`outageRefundRate`):
  - výpadek < 1 den se toleruje (bez refundace);
  - s délkou roste jak pravděpodobnost, že si o vrácení řeknou, tak jeho výše
    (pro-rata za dny mimo provoz, strop 60 %);
  - **UPS** dopad zhruba půlí (udržuje část provozu).
  - Dny výpadku se sčítají per DC během měsíce; refundace se zúčtuje na konci měsíce.
- **Přehlednější stavební paleta (ve stylu Apple).** Paleta nově **skrývá prvky,
  které nejdou v aktuální éře postavit** (přípojky/vysílače nad úroveň technologie)
  i prázdné kategorie — odemykají se automaticky s postupem technologie
  (`isToolAvailable`/`gateBuildPalette`). Méně šumu, jen relevantní volby.
- **Ovládání ve skupinách:** rychlost hry je nově **segmentovaný přepínač**
  (jedna skupina se sdíleným pozadím). Stavební tlačítka a hlavičky kategorií
  mají čistší, vzdušnější „grouped" vzhled.
- **Přehlednější postranní panel — víc místa na scrollování.** Statistické sekce
  (Finance, Síť & Město, Kapacita, Technologie) jsou nově **sbalitelné** (klik na
  nadpis, chevron ▾/▸); sbalením uvolníš místo pro obsah záložek. Stav se pamatuje
  (localStorage). Obsah záložek má garantovanou minimální výšku.

### Fixed
- **Kabely se ničily příliš často** (regrese po zavedení počasí v 0.5/0.6). Bouře
  zničila 2–5 segmentů a měla 50% měsíční šanci, takže malá síť „nevydržela ani
  pár dní". Nově:
  - `stormDamageCount` omezuje škodu na **max ~8 % sítě** a default **1–2 segmenty**;
  - počasní bouře poškodí kabel **vzácně** (~10–20 %/měs dle intenzity) a jen **1 segment**;
  - „Sněhová kalamita" už kabely nemaže přímo, jen nastaví bouřkové počasí (varování).
- `tests/events.test.js` +7 assertů na `stormDamageCount`.
- **macOS trackpad**: dvouprstové posouvání teď **posouvá mapu** (dřív ho hra brala
  jako zoom, takže nešlo panovat). Zoom je nově na **pinch gestu** (sevření dvou
  prstů); kolečko myši zoomuje beze změny.
- **Přehnaná zátěž techniků.** Model počítal 1 „jednotku práce" za každý kus HW
  a kabely dělil jen 80 → i velký tým se tvářil jako přetížený (10 techniků na
  2000 přípojek = přetížení, nesmysl). Přepočítáno (`staffWorkloadUnits`):
  technici škálují hlavně **počtem přípojek** (1 jednotka ≈ 800 přípojek / 800
  kabelů), DC a HW jen drobně. **10 techniků teď pohodlně zvládne 2000+ přípojek.**

### Performance
- **Vyladění výkonu — hra méně žere CPU** (`js/perf.js`). Canvas 2D se dřív
  překresloval při **každém** snímku requestAnimationFrame (na 120Hz ProMotion
  Macu 120 plných redrawů/s). Nově:
  - **FPS cap vykreslování na 40** (nastavitelné `setTargetFps(15–120)`) —
    simulace běží dál každý snímek, ale plný redraw jen v cílové kadenci.
    Na 120Hz displeji to je ~**3× méně** CPU práce v renderu.
  - **Nevykreslujeme při každém pohybu myši / tažení / kolečku** — herní smyčka
    překreslí v cílové kadenci (do ~25 ms). Zmizí desítky zbytečných redrawů/s
    při najíždění myší a tažení mapy.
  - GPU vrstva (PixiJS glow/particles) běží ve stejném rytmu → víc práce na GPU,
    méně na CPU.

### Tests
- `tests/editor.test.js` — 22 assertů; `tests/outagerefund.test.js` — 10 assertů;
  `tests/fieldcrew.test.js` — 12 assertů; `tests/autoupgrade.test.js` — 14 assertů;
  `tests/uigate.test.js` — 17 assertů; `tests/workload.test.js` — 14 assertů;
  `tests/controlcenter.test.js` — 23 assertů; `tests/difficulty.test.js` — 14 assertů;
  `tests/perf.test.js` — 12 assertů; `tests/sidebar.test.js` — 10 assertů;
  `tests/wifiteam.test.js` — 8 assertů; `tests/megadc.test.js` — 23 assertů;
  `tests/theme.test.js` — 8 assertů.

## [0.6.0] — 2026-06-29

Cíle a výzvy, hlubší počasí (intenzita + degradace bezdrátu) a víc provázaných událostí.

### Added

#### 🌩️ Počasí: intenzita + degradace bezdrátu
- Každé počasí má **intenzitu (severity)**, která škáluje jeho dopady
  (slabá vs. silná bouře). HUD ukazuje „slabé/silné".
- **Déšť a bouře degradují bezdrát** — snižují efektivní kapacitu věží,
  nejvíc vysokofrekvenční pásma (mmWave / sub-THz / 6G). Za bouře tak roste
  kongesce bezdrátových zákazníků (přes stávající tower-overload mechaniku).
- GPU vrstva: hustota deště se škáluje s intenzitou.

#### 🎯 Cíle / výzvy (`js/objectives.js`)
- Vždy **3 aktivní cíle** dávají hře směr a odměny (hotovost + nárůst poptávky):
  získej zákazníky, připoj budovy, postav DC/vysílače, odemkni technologii,
  připoj nemocnici/univerzitu, dosáhni měsíčního zisku.
- Po splnění se odměna vyplatí a vygeneruje se nový škálovaný cíl.
- **HUD panel** vlevo nahoře ukazuje cíle s průběhem (X / Y).

#### 🎲 Víc generovaných událostí
- Nové události provázané se systémy: vlna veder / sněhová kalamita (vynutí
  počasí), tendr nemocnice, rozšíření kampusu (růst města), 6G pilot, aukce
  spektra, velký zákazník, výpadek konkurence — vážené dle éry a kontextu.

### Tests
- `tests/weather.test.js` rozšířen na 20 assertů (degradace bezdrátu, škálování intenzitou).
- `tests/objectives.test.js` — 15 assertů (metriky průběhu, splnění, generování).

## [0.5.0] — 2026-06-29

Živé město, dynamické počasí, víc technologií a nové typy budov.

### Added

#### 🌦️ Dynamické počasí (`js/weather.js`)
- Sezónní počasí: jasno / déšť / mlha / **bouře** / **vedro** s váženými přechody
  podle ročního období.
- Herní efekty: **vedro** → vyšší zátěž chlazení DC = dražší elektřina;
  **bouře/vedro** → vyšší riziko výpadku; bouře občas poškodí kabely.
- **GPU vrstva (PixiJS)**: déšť/bouře jako částicové čáry, mlha a horký opar
  jako překryvy, občasný blesk. HUD indikátor aktuálního počasí.

#### 🔬 Víc technologií — 50G/100G PON a 6G
- Nové éry `TECHS`: **50G PON** (2028), **100G PON** (2032), **6G** (2035).
- Drátové přípojky `conn_fiber50g` / `conn_fiber100g` (i v quick-connect menu).
- 6G věže `tower_6g` (FR3) a `tower_6g_thz` (sub-THz).
- Nové tarify: Fiber 50G/100G + mobilní 6G Ultra/Extreme.

#### 🏥 Nové typy budov
- **Nemocnice**, **univerzita**, **nákupní centrum**, **hotel** — každá s vlastním
  profilem poptávky/citlivosti; objevují se **organickým růstem města** podle zóny.
- Napojeno na veřejnou poptávku a B2B nájemce (telemedicína → nemocnice,
  e-learning → univerzita, banka → centrum/hotel).

#### 🏙️ Organický růst města (`js/citygrowth.js`)
- Město už neroste jako pravidelný čtverec — postupně se **zahušťuje kolem
  stávající zástavby** (shlukování na frontieru) a **prorazí si nové ulice**
  do volné plochy, čímž otevírá nové čtvrti (nepravidelný, živý půdorys).
- Tempo růstu **škáluje s prosperitou** hráče (počet zákazníků) a dobou —
  úspěšný ISP přitahuje developery. Roční skok (`cityGrowthTick` v `yearUp`)
  + drobný měsíční přírůstek.
- Respektuje vodu, parky, elektrárny, DC i existující budovy; nové budovy mají
  vizuální efekt umístění.

#### 🎲 Chytřejší generované události (`js/events.js`)
- `randEvent` přepsán na **vážený výběr závislý na éře a kontextu**
  (`weightedPick`): pozdní/specifické události (DDoS, kyber, smart city) se
  neobjeví na startu (`minYear`); bouře jsou pravděpodobnější u rozsáhlé sítě,
  regulace u velkého hráče, cenové války až při dostatku zákazníků atd.
- Nové **události růstu města**: „🏘️ Rozvoj nové čtvrti", „🏭 Nová průmyslová
  zóna" — proženou organický růst a posunou poptávku.

### Tests
- `tests/weather.test.js` — 11 assertů (sezónní váhy, výběr počasí, násobiče).
- `tests/citygrowth.test.js` — 9 assertů (výběr typu budovy dle jádra/periferie/roku,
  škálování objemu růstu, meze).
- `tests/events.test.js` — 10 assertů (vážený los: degenerované vstupy,
  determinismus, přeskočení nulových vah, statistický poměr).

## [0.4.0] — 2026-06-25

Vylepšení herních mechanik, ovládání kamery, vizuálního pocitu a GPU akcelerace.

### Added

#### 🎥 Plynulá kamera (`js/camera.js`)
- Posouvání mapy **šipkami** (↑/↓/←/→) s plynulým dojezdem (exponenciální easing).
- **Setrvačnost** po puštění tažení myší — kamera plynule dojede.
- **Animovaný zoom** kolečkem i tlačítky +/−/⌂ (zachová bod pod kurzorem).
- **Klik / tažení v minimapě** vycentruje kameru na dané místo.
- `updateCamera(dt)` běží v herní smyčce nezávisle na rychlosti hry (funguje i v pauze).

#### ✨ Vizuální zpětná vazba a atmosféra (`js/render.js`)
- **Plovoucí popisky** kotvené na dlaždici (world-space): ⚡ výpadek DC,
  ✓ obnovení, ✓ nová přípojka, 🏗️ nové DC — stoupají a mizí.
- **Gradientové pozadí** místo ploché barvy + jemná **vinětace** okrajů pro hloubku.
- **Animovaný pulzující kroužek** u vybraného datového centra.
- **Noční pouliční osvětlení** — teplé lampy podél silnic se rozsvěcí v noci
  (intenzita podle denní doby).
- **Rozpínavý kroužek** jako efekt při umístění DC / vysílače / WiFi AP.

#### 🧭 Navigace
- **`Tab` / `Shift+Tab`** prochází datacentra — vycentruje kameru a vybere DC.

#### ⚡ Rychlé připojení (quick-connect)
- Klik na **nepřipojenou budovu** v režimu kurzoru otevře malé kontextové menu
  s dostupnými drátovými přípojkami (filtruje podle éry, ukazuje cenu a
  dostupnost) → připojení na **jeden klik** místo tab → modal → potvrzení.
- Zavře se klávesou `Esc`, tlačítkem, výběrem nástroje nebo klikem jinam.

#### ⚠️ Funkční vylepšení
- **Včasné varování před bankrotem**: když je měsíční tok záporný a hotovost
  vydrží < 3 měsíce, hra upozorní (jednou, dokud se situace nezlepší).

#### 📈 Herní mechanika: denní špička (peak hours)
- Poptávka po BW kolísá podle denní doby (`peakDemandMultiplier` v `capacity.js`):
  večerní prime-time **+45 %**, hluboká noc **−15 %**, menší dopolední vrchol.
- Hráč musí dimenzovat kapacitu **na špičku, ne na průměr** — poddimenzovaná síť
  ve špičce trpí kongescí (přes stávající `congPenalty`/`congDrop` → nižší růst
  a pokles spokojenosti). Tematicky navázáno na vizuální day/night cyklus.
- **HUD indikátor** „🌙 Síťová špička" / „🌌 Noční útlum" v horní části plátna.
- **GPU akcelerace**: během špičky PixiJS vrstva zesílí glow přetížených kabelů/DC
  a zvýší hustotu datových částic (síť v noci „rozsvítí").

### Tests
- `tests/camera.test.js` — 27 assertů na čistou logiku kamery
  (mapování kláves, easing, setrvačnost, normalizace diagonály, cyklení DC).
- `tests/quickconnect.test.js` — 12 assertů na logiku quick-connect nabídky
  (filtr podle technologie, affordability, inflace ceny, řazení, vynechání WiFi/bezdrátu).
- `tests/peakdemand.test.js` — 11 assertů na mechaniku denní špičky
  (večerní vrchol, noční útlum, meze, cyklení hodiny).

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
