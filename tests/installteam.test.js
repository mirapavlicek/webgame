#!/usr/bin/env node
/**
 * installteam.test.js — instalační tým pevných přípojek
 * (pickInstallType / installTeamMonthlyConnects z js/actions.js)
 *
 * Co testuje:
 *   1. installTeamMonthlyConnects — škálování (3/tým/měs), meze
 *   2. pickInstallType — nejrychlejší „standard" ≤ 25 000 Kč dle éry,
 *      fallback na nejrychlejší dostupný, null bez peněz/možností
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
const pick = sandbox.pickInstallType;
const monthly = sandbox.installTeamMonthlyConnects;

// Zjednodušené CONN_T (struktura jako constants.js)
const CONN_T = {
  conn_isdn: { name: 'ISDN', cost: 400, maxBW: 1, minTech: 0 },
  conn_adsl: { name: 'ADSL', cost: 2000, maxBW: 20, minTech: 0 },
  conn_vdsl: { name: 'VDSL', cost: 5000, maxBW: 50, minTech: 1 },
  conn_fiber100: { name: 'Optika 100M', cost: 12000, maxBW: 100, minTech: 2 },
  conn_fiber1g: { name: 'Optika 1G', cost: 25000, maxBW: 1000, minTech: 3 },
  conn_fiber10g: { name: 'Optika 10G', cost: 80000, maxBW: 10000, minTech: 4 },
  conn_wifi: { name: 'WiFi', cost: 3500, maxBW: 50, minTech: 1 },
};

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  \u2713 ' + m); } else { fail++; console.log('  \u2717 ' + m); } }

console.log('\u2550\u2550\u2550 Test 1: installTeamMonthlyConnects \u2550\u2550\u2550');
ok(monthly(0) === 0, '0 týmů → 0');
ok(monthly(1) === 3, '1 tým = 3 přípojky/měs');
ok(monthly(4) === 12, '4 týmy = 12');
ok(monthly(-1) === 0, 'záporné → 0');

console.log('\u2550\u2550\u2550 Test 2: pickInstallType — standard dle éry \u2550\u2550\u2550');
ok(pick(CONN_T, 0, 1e9, null) === 'conn_adsl', 'tech 0 → ADSL (nejrychlejší ≤25k)');
ok(pick(CONN_T, 1, 1e9, null) === 'conn_vdsl', 'tech 1 → VDSL');
ok(pick(CONN_T, 2, 1e9, null) === 'conn_fiber100', 'tech 2 → optika 100M');
ok(pick(CONN_T, 4, 1e9, null) === 'conn_fiber1g', 'tech 4 → optika 1G (10G je nad standard)');

console.log('\u2550\u2550\u2550 Test 3: peníze a fallback \u2550\u2550\u2550');
ok(pick(CONN_T, 2, 3000, null) === 'conn_adsl', 'málo peněz → nejrychlejší dostupný standard (ADSL za 2000)');
ok(pick(CONN_T, 2, 1000, null) === 'conn_isdn', 'skoro bez peněz → ISDN');
ok(pick(CONN_T, 2, 100, null) === null, 'bez peněz → null');
ok(pick({}, 5, 1e9, null) === null, 'prázdné CONN_T → null');
// WiFi se neinstaluje pevným týmem (quickConnectOptions ji vynechává)
ok(pick(CONN_T, 1, 1e9, null) !== 'conn_wifi', 'WiFi nikdy');

console.log('\u2550'.repeat(60));
if (fail === 0) { console.log(`\u2705 V\u0160ECHNY TESTY PRO\u0160LY: ${pass}/${pass}`); process.exit(0); }
else { console.log(`\u274c SELHALO: ${fail}, pro\u0161lo: ${pass}`); process.exit(1); }
