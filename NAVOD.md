# NetTycoon — herní návod

> Česká ISP simulační hra. Postav si vlastního poskytovatele internetu
> od počátku milénia až do éry 25G PON.

## Obsah

1. [O čem hra je](#o-čem-hra-je)
2. [Instalace & první spuštění](#instalace--první-spuštění)
3. [První kroky](#první-kroky)
4. [Mapa a budovy](#mapa-a-budovy)
5. [Datacentrum (DC)](#datacentrum-dc)
6. [Kabeláž a přípojky](#kabeláž-a-přípojky)
7. [Tarify a zákazníci](#tarify-a-zákazníci)
8. [Technologický strom](#technologický-strom)
9. [Finance — úvěry, rating, kvartály](#finance--úvěry-rating-kvartály)
10. [Incidenty a vyšetřování](#incidenty-a-vyšetřování)
11. [Zaměstnanci a morálka](#zaměstnanci-a-morálka)
12. [Kontrakty](#kontrakty)
13. [Konkurence, M&A, investoři](#konkurence-ma-investoři)
14. [Pokročilé: bezdrát, DC pohled, heatmapa](#pokročilé)
15. [Ovládání — klávesové zkratky](#ovládání--klávesové-zkratky)
16. [Tipy & strategie](#tipy--strategie)
17. [Ukládání a načítání](#ukládání-a-načítání)

---

## O čem hra je

Jsi začínající ISP v roce 2005. Začínáš s **500 000 Kč** v pokladně, jedním
městem, hromadou domů bez internetu a ADSL technologií. Cílem je rozrůst
se z maličké bedny v garáži na regionálního hráče — stavět datacentra,
pokládat kabely, podepisovat kontrakty s firmami, přežívat incidenty
(přerušené kabely, DDoS, bouřky), konkurovat ostatním ISP a držet zákazníky
spokojené. Po cestě se postupně odemykají novější technologie — VDSL2,
FTTH, XGS-PON až po 25G PON v roce 2025.

Hra je **offline single-player**, běží plně v prohlížeči (desktop build
přes Tauri v2). Čas plyne automaticky, pauza mezerníkem.

---

## Instalace & první spuštění

### Rychlá cesta — stáhni hotový balíček

Na stránce [Releases](https://github.com/mirapavlicek/webgame/releases) najdeš
vždy poslední verzi. Instalace:

**macOS:** stáhni `.dmg`, přetáhni ikonu do Applications. Nepodepsaná
aplikace — v Systémovém nastavení → Soukromí a bezpečnost klikni
"Otevřít přesto". Podrobnosti v [DISTRIBUCE.md](./DISTRIBUCE.md).

**Windows:** stáhni `.exe` nebo `.msi`. SmartScreen warning → "More info"
→ "Run anyway".

### Vývoj z repa

```bash
git clone https://github.com/mirapavlicek/webgame.git
cd webgame
bash vendor/fetch.sh    # PixiJS pro WebGL efekty
python3 -m http.server 8080   # NEBO ./start.command
```

Otevři `http://localhost:8080/`. Pro Tauri dev režim viz [README-TAURI.md](./README-TAURI.md).

---

## První kroky

Po spuštění tě hra uvítá modálem **"Nová firma"**. Zvolíš si jméno, barvu
a startovní strategii. Po potvrzení se objeví mapa 40×40 se silnicemi
a budovami — **zatím bez jediného zákazníka**.

Pořadí úkolů první hodiny hry:

1. **Postav první datacentrum.** Klikni tlačítko **DC Malé** (nebo stiskni `d`)
   a umísti ho na volné políčko poblíž shluku budov. DC je zdroj konektivity —
   bez něj kabely nikam nevedou. Stojí pár stovek tisíc.
2. **Připoj budovy kabelem.** Nástroj **Cu kabel** (`c`) pro levný měděný
   kabel (vhodný pro ISDN/ADSL/VDSL) nebo **Optika** (`f`) pro rychlejší
   trasy. Klikni na DC a táhni k budově. Kabel kopíruje silniční síť.
3. **Aktivuj přípojku.** Klikni na budovu → panel vpravo → vyber typ
   přípojky (ADSL/VDSL/...). Každá přípojka má jednorázovou pořizovací
   cenu + měsíční provoz.
4. **Zkontroluj aktivní tarify.** Záložka **Tarify**. Na startu máš
   aktivní pár základních (ISDN Mini, Start 20, Basic 50). Můžeš si
   kdykoli přidat další, nastavit ceny a sdílené linky (1:10 = levnější,
   pomalejší).
5. **Pusť čas.** Mezerníkem spustíš simulaci, čísla 1/2/3 mění rychlost
   (1×/2×/5×). Zákazníci se začnou sami přihlašovat, pokud je přípojka
   dostupná a tarify konkurenceschopné.

**Cíl prvního roku:** mít aspoň 20-30 platících zákazníků, kladné saldo,
a jedno funkční DC.

---

## Mapa a budovy

Mapa je **izometrická grid** (default 40×40). Barevné dlaždice:

- **Šedá s bílým pruhem** — silnice. Kabely jdou pouze po silnicích.
- **Zelené** — rodinné domy, řadové domy. Nízká poptávka, cenově citliví.
- **Modré** — paneláky, mrakodrapy. Hodně populace, preferují kvalitu.
- **Oranžové** — obchody.
- **Fialové** — velké firmy. Málo populace, ale platí hodně.
- **Hnědé** — průmysl.
- **Červené** — veřejné budovy (školy, úřady).

Každá budova má `units` (počet bytů / kanceláří) a `population`. Zákazníky
získáváš jednotlivě — je možné, že v paneláku s 80 jednotkami a 200 lidmi
máš jen 12 přípojených.

### Expanze mapy

Jakmile zaplníš město, můžeš **dokoupit čtvrtinu mapy** (N/S/E/W) —
tlačítko "Rozšířit mapu" v UI. Cena roste s každou expanzí. Strop je
120×120 — větší mapa už začíná drtit rendering.

---

## Datacentrum (DC)

DC je páteř tvojí sítě. Má 4 velikosti:

- **DC Malé** (~150k Kč, 4 sloty) — pro start
- **DC Střední** (~600k Kč, 8 slotů)
- **DC Velké** (~2M Kč, 16 slotů)
- **DC Hyperscale** (~10M Kč, 32 slotů) — pozdní game

### Patch panel & porty (vnitřní pohled)

**Dvojklik na DC** otevře detailní modal s **patch panelem** a
**port layoutem**. Vidíš:

- Kolik portů máš obsazeno / volno na každém slotu.
- Které kabely do DC vedou (color-coded podle rychlosti).
- Aktivní equipment (servery, firewally, UPS, WiFi APs, switch, LAG bond).

Do každého slotu můžeš nainstalovat **vybavení** (equipment):

- `eq_server` — potřeba pro fiber 100M+
- `eq_firewall` — pro fiber 10G+, banky, firmy
- `eq_backup` — pro fiber 25G a redundanci
- `eq_loadbalancer` — aktivuje multi-path routing z tohoto DC
- `eq_wifiap` — WiFi access pointy (pokrývá okolí WiFi signálem)
- `eq_ups` — záloha při výpadku proudu
- `eq_switch` — víc portů
- `eq_lag` — Link Aggregation Group (sloučí N fyzických linek do jedné
  logické s vyšší BW a automatickým failoverem)

### LAG / LACP / MLAG

Pokročilé: můžeš spojit několik fyzických 10G linek do jedné logické 40G
linky. Když jedna spadne, zbytek dál jede. V DC patch panelu vyber
"Vytvořit LAG bond" a zaškrtni členské porty.

### Propojení DC (dcLinks)

Mezi dvěma DC můžeš pokládat dedikované linky — **dark fiber** (pronájem)
nebo vlastní optika. Síť pak má víc cest a load-balancing rozhodí trafik.

---

## Kabeláž a přípojky

### Typy kabelů

- **Měď (Cu)** — levné, omezená BW, vhodné pro ADSL/VDSL na krátké vzdálenosti.
- **Optika** — vyšší BW, dražší, povinné pro 100M+.
- **Dark fiber** — pronajatá optika do jiného DC (bez nutnosti pokládat).

### Přípojky (connections)

Každá budova může mít **1 aktivní přípojku**:

| Typ | Max BW | Pořizovací | Měsíční | Min tech |
|-----|--------|-----------|---------|----------|
| ISDN | 1 Mbps | 400 Kč | 15 Kč | od startu |
| Koax | 10 Mbps | 1 200 | 22 | od startu |
| ADSL | 20 Mbps | 2 000 | 30 | od startu |
| VDSL | 50 Mbps | 5 000 | 50 | VDSL2 |
| Optika 100M | 100 | 12 000 | 80 | FTTH 100M |
| Optika 1G | 1 000 | 25 000 | 120 | FTTH 1G |
| Optika 10G | 10 000 | 80 000 | 200 | XGS-PON 10G |
| Optika 25G | 25 000 | 200 000 | 500 | 25G PON |

Optika 10G+ vyžaduje `eq_firewall` v DC, 25G navíc `eq_backup`.

### Křižovatky a junction uzly

Kabel jde po silnici od DC k budově. Na křižovatkách si hra umí
vytvořit **junction uzel** — když máš dvě cesty z DC do stejného bodu,
aktivní load-balancer to rozhodí 50/50. Junction vidíš na mapě jako
malý kolový uzel s procenty.

---

## Tarify a zákazníci

Záložka **Tarify** je srdcem monetizace. Máš cca 25 připravených tarifů
rozdělených na:

- **Fixed** — pevná linka (ISDN → 25G)
- **Mobile** — LTE a 5G tarify (potřebují věže, viz dole)
- **Sdílené varianty** (1:10) — poloviční cena, ale N zákazníků sdílí
  stejnou BW. Pro cenové segmenty (chataři, vesnice).

Pro každý tarif můžeš:

- **Aktivovat / deaktivovat** (neaktivní = nenabízí se zákazníkům)
- **Nastavit cenu** (default je rozumná, levnější = víc zákazníků)
- **Vidět statistiky** — kolik zákazníků ho má, hrubý měsíční zisk.

### Jak si zákazník vybírá tarif

Hra vypočítá **skóre tarifu** pro každý dům:

- Cena (`priceSens` budovy)
- Kvalita / spolehlivost (`qualSens`)
- Rychlost vs. `bwRatio` (kolik BW dům reálně použije)
- Preferovaná technologie (`tPref`: 0=DSL, 1=VDSL, 2=FTTH, 3=fiber+)

Mrakodrap by si nikdy nekoupil ISDN Mini. Rodinný dům na vesnici si
neplatí Fiber 25G.

### Business tenanti

Některé velké budovy spawnou **business tenanta** (hosting, banka, škola,
herní studio...). Ten chce **dedikovanou BW + specifické equipment** ale
platí **mnohem víc**. Viz záložka **Klienti**.

---

## Technologický strom

Technologie se odemykají v čase (nebo rychleji přes R&D investice).
Každá vyšší tech level odemyká dražší, rychlejší přípojky a tarify.

| Tech | Rok (auto) | Research cena | Max rychlost |
|------|-----------|---------------|--------------|
| ADSL | 2000 (start) | 0 | 20 Mbps |
| VDSL2 | 2006 | 180k | 50 |
| FTTH 100M | 2010 | 650k | 100 |
| FTTH 1G | 2014 | 2.2M | 1 000 |
| XGS-PON 10G | 2020 | 7.5M | 10 000 |
| 25G PON | 2025 | 18M | 25 000 |

Můžeš si technologii koupit dřív, než ji historie "otevře" — stojí to víc,
ale dostaneš konkurenční výhodu.

---

## Finance — úvěry, rating, kvartály

### Úvěry

Banka ti nabídne půjčky (záložka **Finance**):

- Objem: 500k – 50M Kč
- Úrok (APR): 4-12 %, zavisí na tvém credit ratingu
- Splatnost: 12-60 měsíců
- Automatické měsíční splátky

### Credit rating

Stupnice **AAA → D** (standard). Ovlivňují:

- Poměr dluh / cash
- Počet aktivních úvěrů
- Historie platebních zpoždění
- Spokojenost zákazníků
- Incident recovery

**A+ nebo AAA** ti dají přístup k **nízkoúročným corporate úvěrům** a
**hyperscale DC**. Rating CCC a níž = banka odmítá půjčky.

### Kvartální reporty

Každé 3 měsíce (Q1/Q2/Q3/Q4) dostaneš shrnutí — revenue, EBITDA, capex,
cash flow, churn %, satisfaction. Uvidíš historii v tabulce.

### Investoři (volitelné)

Pokud chceš rychlý kapitál, můžeš prodat **equity investorovi** (např.
VC fond). Dostaneš miliony hotovosti, ale musíš pravidelně platit
**dividendy** nebo riskovat, že tě vyhodí.

---

## Incidenty a vyšetřování

Síť občas spadne. Typy incidentů:

- **Kabel přerušen** — bagr, vandalismus, hlodavec. Kabel vypadne ze
  služby, zákazníci zuří. Oprava stojí peníze a čas.
- **DDoS útok** — zaplavený DC. Bez firewall fronta padá.
- **Výpadek proudu** — bez UPS padá celé DC.
- **HW selhání** — náhodné selhání switch/server/firewall.
- **Bouřka / povodeň** — víc incidentů naráz.

Každý incident má **severity** (1-5) a **ticks** (kolik herních jednotek
trvá než vybouchne naplno). Můžeš pozvat **response team** (úroveň 1-3,
čím dražší tím rychlejší odezva).

### Vyšetřování kabelových incidentů

Pokud je kabel přerušený úmyslně, policie spustí **case**:

- Sbíráš evidence, najmeš právníka
- Soud → výhra = kompenzace, prohra = penále
- Historie case v záložce **Správa → Vyšetřování**

---

## Zaměstnanci a morálka

Záložka **Správa → Tým**. Najímáš:

- **Technici** — rychlejší oprava incidentů
- **Inženýři** — R&D bonus (rychlejší odemykání tech)
- **Operátoři** — výrazně zlepšují response time
- **Sales** — vyšší conversion rate tarifů
- **Support** — zvyšuje satisfaction

Každý typ má **morálku (0-100)** a **úroveň (XP)**. Nastavuješ **měsíční
training budget** — vyšší = rychlejší level-up = silnější efekt.
Morálka padá při přepracování (mnoho incidentů = vyhoření) a lze ji
zlepšit bonusy.

---

## Kontrakty

Záložka **Klienti → Kontrakty**. Dva typy:

### Odměnové kontrakty
Měkká dohoda — "dodej X zákazníků v oblasti Y do konce roku". Splníš =
bonus hotovost. Nesplníš = nic se neděje.

### Opravdové (binding) kontrakty
Tvrdá smlouva s **penále**. Např. "poskytuj 1 Gbps pro firmu Z po dobu
24 měsíců". Pokud výpadek > SLA limit nebo nedodržíš BW, **platíš penále**
(může být velké).

---

## Konkurence, M&A, investoři

### AI konkurenti

Volitelně (checkbox při zakládání firmy) si do hry pustíš **AI ISP**.
Každý má:

- Vlastní DC a kabeláž na tvé mapě
- Pokouší se přetáhnout tvé zákazníky agresivnějšími cenami
- Expanduje, dělá tech research, vyhlašuje expanze
- Občas ti pošle **takeover offer** — chce tě koupit

### M&A

- **Kup konkurenta** (pokud máš dost cash) — dostaneš jeho DC, kabely, zákazníky
- **Prodej sebe** — hra končí s cash_out ziskem (alternativní vítězství)
- **Fúze** — spojíš se s AI, zdvojnásobí síť ale platíš integration cost

### IXP peering

Ze záložky **Síť → BGP** si můžeš koupit připojení do **IXP**
(Internet Exchange Point). Zákazníci mají nižší latenci, satisfaction ↑.

---

## Pokročilé

### Bezdrátová síť (LTE / 5G)

Místo kabelů můžeš stavět **věže**. Každá věž pokryje oblast několika
dlaždic kolem sebe:

- **LTE** — levná, 75 Mbps
- **LTE-A** — 300 Mbps
- **5G** — 2 Gbps
- **5G mmWave** — 20 Gbps (malý dosah)

Věž musí být napojená kabelem na DC. Zákazníci v pokrytí si můžou aktivovat
**mobile tarif** místo fixed.

### WiFi APs

Equipment `eq_wifiap` v DC pokryje okolní budovy signálem. Levné a
rychlé rozšíření bez kabelů.

### DC interní pohled

**Dvojklik na jakékoli DC** → detailní 3D-ish pohled patch panelu, portů,
kabelových propojek. Užitečné pro ladění LAG bondů a troubleshooting.

### Heatmap overlay

Tlačítko **Heatmap** nahoře. Tři módy:

- **Pokrytí** — kde máš signál / kabel
- **Utilizace** — které linky jsou přetížené (červené)
- **Spokojenost** — kteří zákazníci jsou nespokojeni

Použij před expanzí — uvidíš, kde lidé nemají signál nebo kde DC brzy
přetíží.

### Notifikace

Feed notifikací (vpravo dole) má filtry — incident / finance / tech /
milestone. Kritické incidenty jsou červené a můžeš na ně kliknout pro
rychlé řešení.

---

## Ovládání — klávesové zkratky

### Paleta příkazů (**novinka 0.2**)

Paleta funguje podobně jako Cmd+K ve VSCode / Linear — rychlý fuzzy search
přes všechny herní akce, panely a stavební nástroje.

| Klávesa | Akce |
|---------|------|
| `⌘ K` / `Ctrl K` | Otevřít paletu příkazů |
| `/` | Otevřít paletu příkazů (alternativní zkratka) |
| `?` | Zobrazit nápovědu klávesových zkratek |
| `↑` / `↓` | Procházení výsledků v paletě |
| `Enter` | Spustit vybraný příkaz |
| `Esc` | Zavřít paletu / nápovědu |

### Rychlost a nástroje

| Klávesa | Akce |
|---------|------|
| `Mezerník` | Pauza / play |
| `1` | Rychlost 1× |
| `2` | Rychlost 2× |
| `3` | Rychlost 5× |
| `c` | Nástroj — měděný kabel |
| `f` | Nástroj — optika |
| `d` | Nástroj — postavit DC (malé) |
| `x` | Nástroj — demolice / odstranit |
| `Esc` | Zrušit aktivní nástroj / zavřít DC modal |
| `+` / `=` | Zoom in |
| `-` | Zoom out |
| Tažení myší | Posun mapy |
| Klik na budovu | Otevřít detail budovy |
| Dvojklik na DC | Otevřít interní pohled DC |

> **Tip:** Paleta Cmd+K umí přepínat panely (Stavba, Tarify, Cloud…),
> přepnout rychlost, vybrat jakýkoliv stavební prvek (DC, kabely, vysílače,
> DC vybavení), spustit zoom/heatmap a uložit/načíst hru. Stačí začít psát —
> funguje i s diakritikou.

---

## Tipy & strategie

**Začátek (2005-2008):**
- Nesnaž se pokrýt celé město — soustřeď se na 10-15 sousedních budov
  a udělej je profitabilními.
- **ISDN / ADSL** je na startu OK — domy ti dají slušný cash flow bez
  velkých capex.
- Paneláky jsou nejlepší ROI (hodně zákazníků v jedné budově = 1 kabel).

**Mid-game (2010-2015):**
- Upgrade ADSL kabelů na VDSL / FTTH postupně — začni s panel/mrakodrap,
  ne s řadovkou v rohu mapy.
- Koupi první optiku 1G — otevře business tarify (Ultra 1G, Enterprise).
- Hlídej **credit rating** — BBB+ ti dá lepší úvěry pro FTTH kampaň.

**Late-game (2018+):**
- Hyperscale DC se silným load-balancerem a LAG bonds = prakticky
  nedostupný pro incidenty.
- 25G PON pro banky a firemní serverovny — extrémně ziskové.
- IXP peering snižuje latenci → +5-10% satisfaction = méně churn.

**Obecné:**
- **Nešetři na UPS + firewall** — cena je malá vs. penále za velký incident.
- **Morálka techniků > než jejich počet.** 2 spokojení technici řeší
  incidenty rychleji než 5 vyhořelých.
- **Hlídej heatmap utilizace.** Červené linky = kupuj LAG bond nebo
  nový kabel do stejného místa, ne čekej až to spadne.
- **Pauza během incidentu je tvůj přítel.** Nestyď se pauznout a rozhodnout
  klidně — hra tě za to neponalizuje.

---

## Ukládání a načítání

**Menu vlevo nahoře** → **Uložit hru / Načíst hru**.

Uloží se do souboru `nettycoon_<datum>.json` do složky Downloads (web) /
aplikačního Library (Tauri). Pro načtení přetáhneš JSON do modalu, nebo
vybereš souborovým dialogem.

**Autosave** je deaktivovaný (TODO). Ukládej před velkými expanzemi
nebo rizikovými kontrakty.

---

## Debug / developer tipy

- Konzole (`F12` v dev modu) ti ukáže log všech událostí — `[page-load]`,
  `[incident]`, `[capacity]` atd.
- Stav hry je v globálu `G` — zkus v konzoli `console.table(G.tariffs)`.
- Test `js/actions.js::expandMap` pustíš přes `npm test` (63 assertions).

---

Bug reports a návrhy → [GitHub Issues](https://github.com/mirapavlicek/webgame/issues).

Ať hra baví!
