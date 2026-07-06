#!/usr/bin/env node
/**
 * megadc.test.js — multi-tile DC + nová generace HW
 *
 * Co testuje:
 *   1. footprintTiles / coversTile (pure z js/map.js)
 *   2. dcCoversTile s DC_T footprinty (mega 2×1, hyper 2×2)
 *   3. Data nové generace: kabely 1.6T/3.2T, switche 96/256p, routery, transity
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const constSrc = fs.readFileSync(path.join(ROOT, 'js/constants.js'), 'utf8');
const mapSrc = fs.readFileSync(path.join(ROOT, 'js/map.js'), 'utf8');
const sandbox = {};
const proxy = new Proxy(sandbox, { has: () => true, get: (t, k) => (k in t ? t[k] : (k in globalThis ? globalThis[k] : undefined)) });
const ctx = vm.createContext(proxy);
vm.runInContext(constSrc, ctx);
vm.runInContext(mapSrc, ctx);

// const/let ve vm nejdou do sandbox propert — vytáhni přes výrazy
const footprintTiles = vm.runInContext('footprintTiles', ctx);
const coversTile = vm.runInContext('coversTile', ctx);
const dcCoversTile = vm.runInContext('dcCoversTile', ctx);
const CAB_T = vm.runInContext('CAB_T', ctx);
const DC_T = vm.runInContext('DC_T', ctx);
const EQ = vm.runInContext('EQ', ctx);
const BW_UPGRADES = vm.runInContext('BW_UPGRADES', ctx);

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  \u2713 ' + m); } else { fail++; console.log('  \u2717 ' + m); } }

console.log('\u2550\u2550\u2550 Test 1: footprintTiles \u2550\u2550\u2550');
{
  const f1 = footprintTiles(5, 7, 1, 1);
  ok(f1.length === 1 && f1[0].x === 5 && f1[0].y === 7, '1×1 → jedna dlaždice (kotva)');
  const f2 = footprintTiles(5, 7, 2, 1);
  ok(f2.length === 2 && f2[1].x === 6 && f2[1].y === 7, '2×1 → dvě dlaždice východně');
  const f4 = footprintTiles(5, 7, 2, 2);
  ok(f4.length === 4, '2×2 → čtyři dlaždice');
  ok(f4.some(t => t.x === 6 && t.y === 8), '2×2 obsahuje JV roh');
}

console.log('\u2550\u2550\u2550 Test 2: coversTile / dcCoversTile \u2550\u2550\u2550');
{
  ok(coversTile(5, 7, 2, 2, 6, 8) === true, '2×2 od (5,7) pokrývá (6,8)');
  ok(coversTile(5, 7, 2, 2, 7, 7) === false, 'nepokrývá (7,7)');
  ok(coversTile(5, 7, 1, 1, 5, 7) === true, '1×1 pokrývá kotvu');
  const mega = { x: 3, y: 3, type: 'dc_mega' };
  ok(dcCoversTile(mega, 4, 3) === true, 'mega (2×1) pokrývá (4,3)');
  ok(dcCoversTile(mega, 3, 4) === false, 'mega nepokrývá (3,4)');
  const hyper = { x: 3, y: 3, type: 'dc_hyper' };
  ok(dcCoversTile(hyper, 4, 4) === true, 'hyper (2×2) pokrývá (4,4)');
  const small = { x: 0, y: 0, type: 'dc_small' };
  ok(dcCoversTile(small, 0, 0) === true && dcCoversTile(small, 1, 0) === false, 'small = jen 1 dlaždice');
}

console.log('\u2550\u2550\u2550 Test 3: data nové generace \u2550\u2550\u2550');
{
  ok(CAB_T.cable_1600g && CAB_T.cable_1600g.maxBW === 1600000 && CAB_T.cable_1600g.tier === 6, 'kabel 1.6T (tier 6)');
  ok(CAB_T.cable_3200g && CAB_T.cable_3200g.maxBW === 3200000 && CAB_T.cable_3200g.tier === 7, 'kabel 3.2T (tier 7)');
  ok(CAB_T.cable_3200g.maxBW > CAB_T.cable_800g.maxBW, '3.2T > 800G');
  ok(DC_T.dc_mega && DC_T.dc_mega.tilesW === 2 && (DC_T.dc_mega.tilesH || 1) === 1, 'Mega DC = 2×1 pole');
  ok(DC_T.dc_hyper && DC_T.dc_hyper.tilesW === 2 && DC_T.dc_hyper.tilesH === 2, 'Hyperscale = 2×2 pole');
  ok(DC_T.dc_hyper.slots === 128 && DC_T.dc_hyper.baseBW === 200000, 'hyper: 128 slotů, 200G základ');
  ok(DC_T.dc_small.tilesW === undefined, 'stará DC bez footprint polí (default 1×1)');
  ok(EQ.eq_switch96 && EQ.eq_switch96.eff === 'ports' && EQ.eq_switch96.val === 96, 'Switch 96p');
  ok(EQ.eq_switch256 && EQ.eq_switch256.val === 256, 'Switch šasi 256p');
  ok(EQ.eq_router_carrier && EQ.eq_router_carrier.connCap === 250, 'Router Carrier-Max: 250 přípojek');
  ok(EQ.eq_router_tera && EQ.eq_router_tera.connCap === 600, 'Router Tera: 600 přípojek');
  const bw16 = BW_UPGRADES.find(b => b.bw === 1600000);
  const bw32 = BW_UPGRADES.find(b => b.bw === 3200000);
  ok(!!bw16 && !!bw32, 'transity +1.6T a +3.2T existují');
}

console.log('\u2550'.repeat(60));
if (fail === 0) { console.log(`\u2705 V\u0160ECHNY TESTY PRO\u0160LY: ${pass}/${pass}`); process.exit(0); }
else { console.log(`\u274c SELHALO: ${fail}, pro\u0161lo: ${pass}`); process.exit(1); }
