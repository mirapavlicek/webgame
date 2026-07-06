#!/usr/bin/env node
/**
 * waterdc.test.js — velká DC na vodě s vodním chlazením
 * (dcTileAllowed / waterCooledFromTiles / dcMaxCooling z js/map.js, dcPUE z js/energy.js)
 *
 * Co testuje:
 *   1. dcTileAllowed — tráva vždy, voda jen s waterBuild
 *   2. waterCooledFromTiles — bonus jen když CELÝ půdorys je na vodě
 *   3. dcMaxCooling — vodní chlazení +2 jednotky
 *   4. dcPUE — vodně chlazené DC má nižší PUE (base −0.25, floor 1.06)
 *   5. DC_T — velká/mega/hyper mají waterBuild, malá/střední ne
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const sandbox = {};
const proxy = new Proxy(sandbox, { has: () => true, get: (t, k) => (k in t ? t[k] : (k in globalThis ? globalThis[k] : undefined)) });
const ctx = vm.createContext(proxy);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/constants.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/map.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/energy.js'), 'utf8'), ctx);

const dcTileAllowed = vm.runInContext('dcTileAllowed', ctx);
const waterCooledFromTiles = vm.runInContext('waterCooledFromTiles', ctx);
const dcMaxCooling = vm.runInContext('dcMaxCooling', ctx);
const dcPUE = vm.runInContext('dcPUE', ctx);
const DC_T = vm.runInContext('DC_T', ctx);

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  \u2713 ' + m); } else { fail++; console.log('  \u2717 ' + m); } }

console.log('\u2550\u2550\u2550 Test 1: dcTileAllowed \u2550\u2550\u2550');
ok(dcTileAllowed('grass', false) === true, 'tráva vždy OK');
ok(dcTileAllowed('water', false) === false, 'voda bez waterBuild NE');
ok(dcTileAllowed('water', true) === true, 'voda s waterBuild OK');
ok(dcTileAllowed('road', true) === false, 'silnice nikdy');
ok(dcTileAllowed('park', true) === false, 'park nikdy');

console.log('\u2550\u2550\u2550 Test 2: waterCooledFromTiles \u2550\u2550\u2550');
ok(waterCooledFromTiles(['water']) === true, '1×1 celé na vodě → ano');
ok(waterCooledFromTiles(['water', 'water', 'water', 'water']) === true, '2×2 celé na vodě → ano');
ok(waterCooledFromTiles(['water', 'grass']) === false, 'smíšené pobřeží → ne');
ok(waterCooledFromTiles(['grass']) === false, 'na trávě → ne');
ok(waterCooledFromTiles([]) === false, 'prázdné → ne');

console.log('\u2550\u2550\u2550 Test 3: dcMaxCooling \u2550\u2550\u2550');
ok(dcMaxCooling({ type: 'dc_large', waterCooled: false }) === 4, 'velké DC na souši: 4');
ok(dcMaxCooling({ type: 'dc_large', waterCooled: true }) === 6, 'velké DC na vodě: 4+2=6');
ok(dcMaxCooling({ type: 'dc_hyper', waterCooled: true }) === 12, 'hyper na vodě: 10+2=12');
ok(dcMaxCooling({ type: 'dc_small' }) === 1, 'malé DC (bez waterCooled pole): 1');

console.log('\u2550\u2550\u2550 Test 4: dcPUE s vodním chlazením \u2550\u2550\u2550');
{
  const land = dcPUE({ type: 'dc_large', eq: [] });
  const water = dcPUE({ type: 'dc_large', eq: [], waterCooled: true });
  ok(Math.abs(land - 1.70) < 1e-9, `velké DC na souši: PUE 1.70 (${land})`);
  ok(Math.abs(water - 1.45) < 1e-9, `na vodě: PUE 1.45 (−0.25) (${water})`);
  // s hodně chlazením: floor 1.06 pro vodní vs 1.10 na souši
  const eqMany = ['eq_cooling', 'eq_cooling', 'eq_cooling', 'eq_cooling', 'eq_cooling', 'eq_cooling'];
  const landMax = dcPUE({ type: 'dc_large', eq: eqMany });
  const waterMax = dcPUE({ type: 'dc_large', eq: eqMany, waterCooled: true });
  ok(landMax >= 1.10 - 1e-9, `souš floor 1.10 (${landMax})`);
  ok(waterMax >= 1.06 - 1e-9 && waterMax < landMax, `voda floor 1.06 a lepší než souš (${waterMax})`);
}

console.log('\u2550\u2550\u2550 Test 5: DC_T waterBuild \u2550\u2550\u2550');
ok(DC_T.dc_large.waterBuild === true, 'velké DC smí na vodu');
ok(DC_T.dc_mega.waterBuild === true, 'mega smí na vodu');
ok(DC_T.dc_hyper.waterBuild === true, 'hyper smí na vodu');
ok(!DC_T.dc_small.waterBuild && !DC_T.dc_medium.waterBuild, 'malé/střední na vodu nesmí');

console.log('\u2550'.repeat(60));
if (fail === 0) { console.log(`\u2705 V\u0160ECHNY TESTY PRO\u0160LY: ${pass}/${pass}`); process.exit(0); }
else { console.log(`\u274c SELHALO: ${fail}, pro\u0161lo: ${pass}`); process.exit(1); }
