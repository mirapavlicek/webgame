#!/usr/bin/env node
/**
 * expandmap.test.js — statické ověření expandMap (task #53)
 *
 * Spouští se: `node tests/expandmap.test.js` (z rootu repa)
 *
 * Co testuje:
 *   1. Všechny 4 směry (N/S/E/W) vrátí správnou velikost mapy
 *   2. Pro E/S (bez offsetu) zůstanou souřadnice všech entit nezměněné
 *   3. Pro N/W se VŠECHNY entity posunou o delta v příslušné ose
 *      — DCs, conns(bx/by), cables, junctions, towers, wifiAPs,
 *        darkFiber, cableCuts
 *   4. G.cash se sníží o cost a G.expansions dostane nový záznam
 *   5. MAP/mapSize/G.map.length jsou konzistentní po expanzi
 *   6. Limit MAP_MAX drží (canExpandMap vrací false když se dosáhne)
 *   7. Nedostatek peněz zablokuje expanzi
 *
 * Logika je verbatim kopie z js/actions.js (expandMap + canExpandMap),
 * jen s minimálními stuby pro globaly co expandMap normálně volá
 * (notify, markCapDirty, calcCapacity, updUI).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// =========================================================================
// Načti zdrojové soubory, které budeme testovat / potřebujeme pro kontext
// =========================================================================
const ROOT = path.resolve(__dirname, '..');
function loadJS(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

const actionsSrc = loadJS('js/actions.js');
const constantsSrc = loadJS('js/constants.js');

// Vytáhni z constants.js jen MAP_MAX a BTYPES — ostatní by táhlo půlku hry
const mapMaxMatch = constantsSrc.match(/const\s+MAP_MAX\s*=\s*(\d+)/);
if (!mapMaxMatch) throw new Error('MAP_MAX nenalezen v constants.js');
const MAP_MAX_VALUE = parseInt(mapMaxMatch[1], 10);

// Vytáhni BTYPES blok (potřebujeme strukturu pro budovy v nové oblasti)
// Použijeme stub, který obsahuje jen klíčové typy, co expandMap používá
const BTYPES_STUB = {
  house:     { h: 38, clr: '#9ca3af', units: [1, 2],  pop: [2, 4],   demand: 0.55, growth: 0.02, priceSens: 1, qualSens: 1 },
  rowhouse:  { h: 44, clr: '#9ca3af', units: [2, 4],  pop: [4, 8],   demand: 0.55, growth: 0.02, priceSens: 1, qualSens: 1 },
  shop:      { h: 36, clr: '#9ca3af', units: [1, 3],  pop: [2, 6],   demand: 0.55, growth: 0.02, priceSens: 1, qualSens: 1 },
  panel:     { h: 75, clr: '#9ca3af', units: [8, 20], pop: [20, 50], demand: 0.55, growth: 0.02, priceSens: 1, qualSens: 1 },
  factory:   { h: 50, clr: '#9ca3af', units: [1, 3],  pop: [5, 15],  demand: 0.55, growth: 0.02, priceSens: 1, qualSens: 1 },
  public:    { h: 40, clr: '#9ca3af', units: [3, 6],  pop: [10, 20], demand: 0.55, growth: 0.02, priceSens: 1, qualSens: 1 },
  skyscraper:{ h: 140,clr: '#9ca3af', units: [20, 40],pop: [50, 100],demand: 0.55, growth: 0.02, priceSens: 1, qualSens: 1 },
  bigcorp:   { h: 80, clr: '#9ca3af', units: [10, 20],pop: [20, 40], demand: 0.55, growth: 0.02, priceSens: 1, qualSens: 1 },
};

// =========================================================================
// Stuby globálních funkcí, které expandMap volá
// =========================================================================
let notifyLog = [];
const stubs = `
  var MAP = 30;
  var MAP_MAX = ${MAP_MAX_VALUE};
  var BTYPES = ${JSON.stringify(BTYPES_STUB)};
  var G = null;
  var notifyLog = [];
  function notify(msg, kind){ notifyLog.push({msg,kind}); }
  function markCapDirty(){ /* no-op in test */ }
  function calcCapacity(){ /* no-op in test */ }
  function updUI(){ /* no-op in test */ }
  function segKey(x1,y1,x2,y2){
    const ax=Math.min(x1,x2),ay=Math.min(y1,y2),bx=Math.max(x1,x2),by=Math.max(y1,y2);
    return ax+','+ay+','+bx+','+by;
  }
  function fmt(n){ return String(Math.round(n||0)); }
  function fmtKc(n){ return String(Math.round(n||0))+' Kč'; }
`;

// Slož kontext: stuby + actions.js (obsahuje expandMap + canExpandMap)
// Actions.js má hodně dalších funkcí, které závisí na dalších globalech — těm
// dáme prázdné stuby, aby parsing prošel. expandMap se nedotkne.
const extraStubs = `
  // Stuby pro cokoliv dalšího v actions.js, co by mohlo být definováno před
  // voláním expandMap. actions.js jen deklaruje funkce — nic se při načtení
  // neprovede, takže stuby nejsou kritické, jen musí být definované při runtime.
  function dcHasRouter(){ return true; }
  function getDCNetCapacity(){ return {usedPorts:0,totalPorts:10}; }
  function anyDCHasEq(){ return false; }
  function getStaffEffect(){ return 0; }
  function getTowerClients(){ return 0; }
  function getDCCompute(){ return {vCPU:0,ram:0}; }
  function getDCStorage(){ return {total:0}; }
  function calcCloudRevenue(){ return 0; }
  function pickTariffForCustomer(){ return null; }
  function addToTariffDist(){ }
  function removeFromTariffDist(){ }
  function calcBldRevenue(){ return 0; }
  function refPrice(){ return 1; }
  function getAvailTariffs(){ return []; }
  function networkHasEq(){ return true; }
  var DC_T = {}, CAB_T = {}, CONN_T = {}, TOWER_T = {}, WIFI_T = {},
      EQ = {}, SLA_TIERS = [], CLOUD_PRICING = {}, CLOUD_SEGMENTS = [],
      STAFF_T = {}, DEF_TARIFFS = [], TECHS = [], IXP = {mCost:0},
      DARK_FIBER = {revenuePerSeg:0}, JUNCTION_T = {}, BW_UPGRADES = [],
      SERVICES = [], BIZ_TENANTS = [];
`;

const context = vm.createContext({});
vm.runInContext(stubs + extraStubs + actionsSrc, context);

// =========================================================================
// Helpers pro testování
// =========================================================================
function makeMap(size) {
  const m = [];
  for (let y = 0; y < size; y++) {
    const row = [];
    for (let x = 0; x < size; x++) {
      // Páteřní kříž silnic uprostřed — aby expandMap měl co prodlužovat
      const mid = Math.floor(size / 2);
      const isRoad = x === mid || y === mid;
      row.push({ type: isRoad ? 'road' : 'grass', bld: null, variant: 0 });
    }
    m.push(row);
  }
  return m;
}

function makeTestGame(size) {
  return {
    cash: 10_000_000,
    map: makeMap(size),
    mapSize: size,
    cables: [
      { x1: 2, y1: 2, x2: 5, y2: 2, t: 'cable_fiber1' },
      { x1: 5, y1: 2, x2: 5, y2: 8, t: 'cable_fiber1' },
    ],
    dcs: [
      { x: 5, y: 5, type: 'dc_small', eq: [], bwUpgrades: [], outage: { active: false, remaining: 0, cause: '' } },
    ],
    conns: [
      { bx: 2, by: 2, di: 0 },
      { bx: 5, by: 8, di: 0 },
    ],
    dcLinks: [], // teče přes buildDCLinks — shiftování je no-op
    junctions: [{ x: 3, y: 5, type: 'j_basic', active: true }],
    towers: [{ x: 7, y: 2, type: 't_lte', dcIdx: 0 }],
    wifiAPs: [{ x: 4, y: 4, type: 'wifi_basic' }],
    darkFiber: [{ x1: 1, y1: 1, x2: 8, y2: 8 }],
    cableCuts: [{
      segKey: '2,2,5,2', x1: 2, y1: 2, x2: 5, y2: 2,
      incidentId: 'i1', dcIdx: 0, cableType: 'cable_fiber1', since: { y: 2010, m: 5 }
    }],
    upgrades: [],
    services: [],
    svcPrices: {},
    stats: { inc: 0, exp: 0, cust: 0, hist: [] },
    tariffs: [],
    expansions: [],
    date: { y: 2010, m: 5, d: 1 },
  };
}

function deepCopyCoords(g) {
  return {
    cables: g.cables.map(c => ({ x1: c.x1, y1: c.y1, x2: c.x2, y2: c.y2 })),
    dcs: g.dcs.map(d => ({ x: d.x, y: d.y })),
    conns: g.conns.map(c => ({ bx: c.bx, by: c.by })),
    junctions: g.junctions.map(j => ({ x: j.x, y: j.y })),
    towers: g.towers.map(t => ({ x: t.x, y: t.y })),
    wifiAPs: g.wifiAPs.map(w => ({ x: w.x, y: w.y })),
    darkFiber: g.darkFiber.map(f => ({ x1: f.x1, y1: f.y1, x2: f.x2, y2: f.y2 })),
    cableCuts: g.cableCuts.map(c => ({ x1: c.x1, y1: c.y1, x2: c.x2, y2: c.y2, segKey: c.segKey })),
  };
}

// =========================================================================
// Asserce
// =========================================================================
let passCount = 0, failCount = 0;
function assert(cond, msg) {
  if (cond) { passCount++; console.log('  ✓ ' + msg); }
  else      { failCount++; console.error('  ✗ ' + msg); }
}
function assertEq(actual, expected, msg) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passCount++; console.log('  ✓ ' + msg); }
  else    { failCount++; console.error('  ✗ ' + msg + '\n      got:      ' + JSON.stringify(actual) + '\n      expected: ' + JSON.stringify(expected)); }
}

// =========================================================================
// Test harness — nastaví context a zavolá expandMap
// =========================================================================
function runExpansion(dir, gameOverride) {
  // Nastav globaly v context
  const g = gameOverride || makeTestGame(30);
  context.G = g;
  context.MAP = g.mapSize;
  context.notifyLog = [];
  const before = { MAP: g.mapSize, cash: g.cash, coords: deepCopyCoords(g) };
  // Zavolej
  const beforeFail = context.notifyLog ? context.notifyLog.length : 0;
  vm.runInContext(`expandMap('${dir}')`, context);
  const after = {
    MAP: context.MAP,
    cash: g.cash,
    mapSize: g.mapSize,
    mapLen: g.map.length,
    expansions: g.expansions.slice(),
    coords: deepCopyCoords(g),
    notifies: context.notifyLog.slice(beforeFail),
  };
  return { g, before, after };
}

function expectShifted(before, after, offX, offY, label) {
  // Cables
  for (let i = 0; i < before.cables.length; i++) {
    assertEq(
      { x1: after.cables[i].x1, y1: after.cables[i].y1, x2: after.cables[i].x2, y2: after.cables[i].y2 },
      { x1: before.cables[i].x1 + offX, y1: before.cables[i].y1 + offY, x2: before.cables[i].x2 + offX, y2: before.cables[i].y2 + offY },
      `${label}: cables[${i}] posunuty o (${offX},${offY})`
    );
  }
  assertEq(after.dcs[0], { x: before.dcs[0].x + offX, y: before.dcs[0].y + offY }, `${label}: DC posunuto`);
  assertEq(after.conns[0], { bx: before.conns[0].bx + offX, by: before.conns[0].by + offY }, `${label}: conn[0].bx/by posunuty`);
  assertEq(after.junctions[0], { x: before.junctions[0].x + offX, y: before.junctions[0].y + offY }, `${label}: junction posunut`);
  assertEq(after.towers[0], { x: before.towers[0].x + offX, y: before.towers[0].y + offY }, `${label}: tower posunuta`);
  assertEq(after.wifiAPs[0], { x: before.wifiAPs[0].x + offX, y: before.wifiAPs[0].y + offY }, `${label}: wifiAP posunut`);
  assertEq(after.darkFiber[0], {
    x1: before.darkFiber[0].x1 + offX, y1: before.darkFiber[0].y1 + offY,
    x2: before.darkFiber[0].x2 + offX, y2: before.darkFiber[0].y2 + offY
  }, `${label}: darkFiber posunut`);
  assertEq(after.cableCuts[0].x1, before.cableCuts[0].x1 + offX, `${label}: cableCut x1 posunut`);
  // segKey by měl být přepočítán
  assert(after.cableCuts[0].segKey !== before.cableCuts[0].segKey || (offX === 0 && offY === 0),
         `${label}: cableCut segKey přepočítán po posunu`);
}

// =========================================================================
// TESTY
// =========================================================================
console.log('\n═══ Test 1: Expanze na východ (E) — žádný offset ═══');
{
  const { g, before, after } = runExpansion('e');
  assert(after.MAP > before.MAP, `MAP se zvětšil: ${before.MAP} → ${after.MAP}`);
  assertEq(after.mapSize, after.MAP, 'G.mapSize === MAP');
  assertEq(after.mapLen, after.MAP, 'G.map.length === MAP');
  assertEq(after.mapLen, g.map[0].length, 'G.map je čtverec (height === width)');
  assert(g.cash < before.cash, `cash se snížil: ${before.cash} → ${g.cash}`);
  assert(after.expansions.length === 1, 'G.expansions má 1 nový záznam');
  assertEq(after.expansions[0].dir, 'e', 'Expansion záznam má správný směr');
  expectShifted(before.coords, after.coords, 0, 0, 'E');
}

console.log('\n═══ Test 2: Expanze na jih (S) — žádný offset ═══');
{
  const { g, before, after } = runExpansion('s');
  assert(after.MAP > before.MAP, `MAP se zvětšil: ${before.MAP} → ${after.MAP}`);
  expectShifted(before.coords, after.coords, 0, 0, 'S');
}

console.log('\n═══ Test 3: Expanze na západ (W) — offset X ═══');
{
  const { g, before, after } = runExpansion('w');
  const delta = after.MAP - before.MAP;
  assert(delta > 0, `delta=${delta}`);
  expectShifted(before.coords, after.coords, delta, 0, 'W');
}

console.log('\n═══ Test 4: Expanze na sever (N) — offset Y ═══');
{
  const { g, before, after } = runExpansion('n');
  const delta = after.MAP - before.MAP;
  assert(delta > 0, `delta=${delta}`);
  expectShifted(before.coords, after.coords, 0, delta, 'N');
}

console.log('\n═══ Test 5: Nedostatek peněz zablokuje expanzi ═══');
{
  const g = makeTestGame(30);
  g.cash = 100; // naprosto nedostatečné
  context.G = g;
  context.MAP = 30;
  context.notifyLog = [];
  const mapBefore = context.MAP;
  vm.runInContext(`expandMap('e')`, context);
  assertEq(context.MAP, mapBefore, 'MAP se při nedostatku peněz nezměnil');
  assert(context.notifyLog.some(n => /Chybí/.test(n.msg)), 'notify vypíše "Chybí"');
  assert(g.expansions.length === 0, 'Žádný záznam v G.expansions při selhání');
}

console.log('\n═══ Test 6: MAP_MAX strop ═══');
{
  const g = makeTestGame(MAP_MAX_VALUE);
  context.G = g;
  context.MAP = MAP_MAX_VALUE;
  context.notifyLog = [];
  vm.runInContext(`expandMap('e')`, context);
  assertEq(context.MAP, MAP_MAX_VALUE, 'MAP zůstal na MAP_MAX');
  assert(context.notifyLog.some(n => /strop/.test(n.msg)), 'notify zmíní "strop"');
}

console.log('\n═══ Test 7: Po expanzi jsou nové tiles validní ═══');
{
  const { g, after } = runExpansion('e');
  for (let y = 0; y < g.map.length; y++) {
    for (let x = 0; x < g.map[y].length; x++) {
      const t = g.map[y][x];
      if (!t || !t.type) {
        assert(false, `[${x},${y}] tile má nevalidní type`);
        return;
      }
    }
  }
  assert(true, `Všech ${after.MAP}×${after.MAP} tilů má validní type`);
}

console.log('\n═══ Test 8: Řetězení expanzí (E pak N pak W) ═══');
{
  const g = makeTestGame(30);
  context.G = g;
  context.MAP = 30;
  context.notifyLog = [];
  const origDCx = g.dcs[0].x, origDCy = g.dcs[0].y;

  vm.runInContext(`expandMap('e')`, context);
  const afterE = { MAP: context.MAP, dcX: g.dcs[0].x, dcY: g.dcs[0].y };
  assertEq(afterE.dcX, origDCx, 'Po E: DC.x nezměněn');
  assertEq(afterE.dcY, origDCy, 'Po E: DC.y nezměněn');

  vm.runInContext(`expandMap('n')`, context);
  const afterN = { MAP: context.MAP, dcX: g.dcs[0].x, dcY: g.dcs[0].y };
  const deltaN = afterN.MAP - afterE.MAP;
  assertEq(afterN.dcX, afterE.dcX, 'Po N: DC.x nezměněn');
  assertEq(afterN.dcY, afterE.dcY + deltaN, `Po N: DC.y posunut o ${deltaN}`);

  vm.runInContext(`expandMap('w')`, context);
  const afterW = { MAP: context.MAP, dcX: g.dcs[0].x, dcY: g.dcs[0].y };
  const deltaW = afterW.MAP - afterN.MAP;
  assertEq(afterW.dcX, afterN.dcX + deltaW, `Po W: DC.x posunut o ${deltaW}`);
  assertEq(afterW.dcY, afterN.dcY, 'Po W: DC.y nezměněn');
  assert(g.expansions.length === 3, 'G.expansions má 3 záznamy po 3 expanzích');
}

// =========================================================================
// Shrnutí
// =========================================================================
console.log('\n' + '═'.repeat(60));
if (failCount === 0) {
  console.log(`✅ VŠECHNY TESTY PROŠLY: ${passCount}/${passCount}`);
  process.exit(0);
} else {
  console.log(`❌ SELHALO: ${failCount} / PROŠLO: ${passCount}`);
  process.exit(1);
}
