#!/usr/bin/env node
/**
 * autoupgrade.test.js — plynulý upgrade přípojek (nextWiredUpgrade z js/actions.js)
 *
 * Co testuje:
 *   1. Vybere nejbližší vyšší drátový tier dostupný v éře
 *   2. Respektuje technologický limit (minTech)
 *   3. Bezdrátové/WiFi se neupgradují (null)
 *   4. Nejrychlejší přípojka už nemá kam růst (null)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'js/actions.js'), 'utf8');
const sandbox = {};
const proxy = new Proxy(sandbox, { has: () => true, get: (t, k) => (k in t ? t[k] : (k in globalThis ? globalThis[k] : undefined)) });
vm.runInContext(src, vm.createContext(proxy));
const next = sandbox.nextWiredUpgrade;

// Zjednodušené CONN_T odpovídající struktuře z constants.js
const CONN_T = {
  conn_isdn: { maxBW: 1, minTech: 0 },
  conn_coax: { maxBW: 10, minTech: 0 },
  conn_adsl: { maxBW: 20, minTech: 0 },
  conn_vdsl: { maxBW: 50, minTech: 1 },
  conn_fiber100: { maxBW: 100, minTech: 2 },
  conn_fiber1g: { maxBW: 1000, minTech: 3 },
  conn_fiber10g: { maxBW: 10000, minTech: 4 },
  conn_fiber25g: { maxBW: 25000, minTech: 5 },
  conn_fiber50g: { maxBW: 50000, minTech: 6 },
  conn_fiber100g: { maxBW: 100000, minTech: 7 },
  conn_wifi: { maxBW: 50, minTech: 1 },
  conn_lte: { maxBW: 75, minTech: 1 },
  conn_5g: { maxBW: 2000, minTech: 3 },
};

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  \u2713 ' + m); } else { fail++; console.log('  \u2717 ' + m); } }

console.log('\u2550\u2550\u2550 Test 0: existence \u2550\u2550\u2550');
ok(typeof next === 'function', 'nextWiredUpgrade je definovaná');

console.log('\u2550\u2550\u2550 Test 1: nejbližší vyšší tier \u2550\u2550\u2550');
ok(next('conn_isdn', CONN_T, 9) === 'conn_coax', 'ISDN → koax (nejbližší vyšší)');
ok(next('conn_adsl', CONN_T, 9) === 'conn_vdsl', 'ADSL → VDSL');
ok(next('conn_vdsl', CONN_T, 9) === 'conn_fiber100', 'VDSL → optika 100M');
ok(next('conn_fiber10g', CONN_T, 9) === 'conn_fiber25g', '10G → 25G');

console.log('\u2550\u2550\u2550 Test 2: technologický limit \u2550\u2550\u2550');
ok(next('conn_adsl', CONN_T, 0) === null, 'tech 0: z ADSL není rychlejší dostupný tier (VDSL až tech 1)');
ok(next('conn_isdn', CONN_T, 0) === 'conn_coax', 'tech 0: ISDN → koax (dostupné)');
ok(next('conn_vdsl', CONN_T, 1) === null, 'tech 1: z VDSL není vyšší dostupný tier');
ok(next('conn_vdsl', CONN_T, 2) === 'conn_fiber100', 'tech 2: z VDSL už na optiku 100M');

console.log('\u2550\u2550\u2550 Test 3: bezdrát/WiFi se neupgraduje \u2550\u2550\u2550');
ok(next('conn_wifi', CONN_T, 9) === null, 'WiFi → null');
ok(next('conn_lte', CONN_T, 9) === null, 'LTE → null');
ok(next('conn_5g', CONN_T, 9) === null, '5G → null');

console.log('\u2550\u2550\u2550 Test 4: strop a neznámé \u2550\u2550\u2550');
ok(next('conn_fiber100g', CONN_T, 9) === null, 'nejrychlejší (100G) → null');
ok(next('neznamy', CONN_T, 9) === null, 'neznámý typ → null');

console.log('\u2550'.repeat(60));
if (fail === 0) { console.log(`\u2705 V\u0160ECHNY TESTY PRO\u0160LY: ${pass}/${pass}`); process.exit(0); }
else { console.log(`\u274c SELHALO: ${fail}, pro\u0161lo: ${pass}`); process.exit(1); }
