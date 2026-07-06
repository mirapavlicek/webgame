#!/usr/bin/env node
/**
 * wifiteam.test.js — bezdrátový instalační tým (wifiTeamMonthlyConnects z js/wifi.js)
 *
 * Co testuje:
 *   1. Bez týmu → 0
 *   2. Škáluje s počtem týmů (4 domy/tým/měsíc)
 *   3. Nezáporné, degenerované vstupy
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'js/wifi.js'), 'utf8');
const sandbox = {};
const proxy = new Proxy(sandbox, { has: () => true, get: (t, k) => (k in t ? t[k] : (k in globalThis ? globalThis[k] : undefined)) });
vm.runInContext(src, vm.createContext(proxy));
const f = sandbox.wifiTeamMonthlyConnects;

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  \u2713 ' + m); } else { fail++; console.log('  \u2717 ' + m); } }

console.log('\u2550\u2550\u2550 Test 0: existence \u2550\u2550\u2550');
ok(typeof f === 'function', 'wifiTeamMonthlyConnects je definovaná');

console.log('\u2550\u2550\u2550 Test 1: bez týmu \u2550\u2550\u2550');
ok(f(0) === 0, '0 týmů → 0');
ok(f(-2) === 0, 'záporné → 0');
ok(f(null) === 0, 'null → 0');

console.log('\u2550\u2550\u2550 Test 2: škálování \u2550\u2550\u2550');
ok(f(1) === 4, '1 tým = 4 domy/měs');
ok(f(3) === 12, '3 týmy = 12 domů/měs');
ok(f(5) > f(2), 'víc týmů → víc připojení');

console.log('\u2550\u2550\u2550 Test 3: nezápornost \u2550\u2550\u2550');
{
  let good = true;
  for (let t = 0; t <= 20; t++) if (f(t) < 0) good = false;
  ok(good, 'nikdy záporné');
}

console.log('\u2550'.repeat(60));
if (fail === 0) { console.log(`\u2705 V\u0160ECHNY TESTY PRO\u0160LY: ${pass}/${pass}`); process.exit(0); }
else { console.log(`\u274c SELHALO: ${fail}, pro\u0161lo: ${pass}`); process.exit(1); }
