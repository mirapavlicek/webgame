#!/usr/bin/env node
/**
 * quickconnect.test.js — ověření čisté logiky quick-connect menu
 * (funkce quickConnectOptions v js/actions.js)
 *
 * Spouští se: `node tests/quickconnect.test.js` (z rootu repa)
 *
 * Co testuje:
 *   1. Filtruje podle dostupné technologie (minTech <= tech)
 *   2. Příznak affordable podle hotovosti
 *   3. Aplikuje inflační funkci na cenu
 *   4. Řadí podle rychlosti (maxBW vzestupně)
 *   5. Vynechává bezdrátové/WiFi typy (nepatří do drátového quick-connectu)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'js/actions.js'), 'utf8');

// Sandbox s Proxy — undeklarované globály vrací undefined místo ReferenceError.
const sandbox = {};
const proxy = new Proxy(sandbox, { has: () => true, get: (t, k) => (k in t ? t[k] : undefined) });
const context = vm.createContext(proxy);
vm.runInContext(src, context);
const quickConnectOptions = sandbox.quickConnectOptions;

// Minimální CONN_T odpovídající struktuře z constants.js (drátové + bezdrátové).
const CONN_T = {
  conn_isdn: { name: 'ISDN', cost: 400, maxBW: 1, icon: '☎️', minTech: 0 },
  conn_adsl: { name: 'ADSL', cost: 2000, maxBW: 20, icon: '📞', minTech: 0 },
  conn_vdsl: { name: 'VDSL', cost: 5000, maxBW: 50, icon: '📡', minTech: 1 },
  conn_fiber100: { name: 'Optika 100M', cost: 12000, maxBW: 100, icon: '💠', minTech: 2 },
  conn_fiber1g: { name: 'Optika 1G', cost: 25000, maxBW: 1000, icon: '💎', minTech: 3 },
  conn_coax: { name: 'Koaxiál', cost: 1200, maxBW: 10, icon: '📺', minTech: 0 },
  conn_fiber10g: { name: 'Optika 10G', cost: 80000, maxBW: 10000, icon: '⚡', minTech: 4 },
  conn_fiber25g: { name: 'Optika 25G', cost: 200000, maxBW: 25000, icon: '🔥', minTech: 5 },
  // tyto se NESMÍ objevit ve výstupu:
  conn_wifi: { name: 'WiFi', cost: 3500, maxBW: 50, icon: '📶', minTech: 1 },
  conn_lte: { name: 'LTE', cost: 0, maxBW: 75, icon: '📱', minTech: 1 },
  conn_5g: { name: '5G', cost: 0, maxBW: 2000, icon: '📶', minTech: 3 },
};

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log('  \u2713 ' + msg); }
  else { fail++; console.log('  \u2717 ' + msg); }
}

console.log('\u2550\u2550\u2550 Test 0: funkce existuje \u2550\u2550\u2550');
ok(typeof quickConnectOptions === 'function', 'quickConnectOptions je definovaná');

console.log('\u2550\u2550\u2550 Test 1: filtr podle technologie \u2550\u2550\u2550');
{
  const opts = quickConnectOptions(CONN_T, 0, 1e9, null);
  const keys = opts.map(o => o.key);
  ok(keys.includes('conn_isdn') && keys.includes('conn_adsl') && keys.includes('conn_coax'), 'tech 0 obsahuje ISDN/ADSL/koax');
  ok(!keys.includes('conn_vdsl') && !keys.includes('conn_fiber100'), 'tech 0 nevidí VDSL/optiku');
}
{
  const opts = quickConnectOptions(CONN_T, 5, 1e9, null);
  ok(opts.length === 8, `tech 5 zpřístupní všech 8 drátových typů (${opts.length})`);
}

console.log('\u2550\u2550\u2550 Test 2: bezdrátové/WiFi vynechány \u2550\u2550\u2550');
{
  const keys = quickConnectOptions(CONN_T, 5, 1e9, null).map(o => o.key);
  ok(!keys.includes('conn_wifi'), 'WiFi není v nabídce');
  ok(!keys.includes('conn_lte') && !keys.includes('conn_5g'), 'LTE/5G nejsou v nabídce');
}

console.log('\u2550\u2550\u2550 Test 3: affordable podle hotovosti \u2550\u2550\u2550');
{
  const opts = quickConnectOptions(CONN_T, 2, 2500, null); // dosáhne na ISDN(400), koax(1200), ADSL(2000), ne VDSL(5000)
  const byKey = Object.fromEntries(opts.map(o => [o.key, o]));
  ok(byKey.conn_isdn.affordable === true, 'ISDN dostupné při 2500');
  ok(byKey.conn_adsl.affordable === true, 'ADSL dostupné při 2500');
  ok(byKey.conn_vdsl.affordable === false, 'VDSL nedostupné při 2500');
}

console.log('\u2550\u2550\u2550 Test 4: inflační funkce na cenu \u2550\u2550\u2550');
{
  const infl = c => c * 2;
  const opts = quickConnectOptions(CONN_T, 0, 1e9, infl);
  const isdn = opts.find(o => o.key === 'conn_isdn');
  ok(isdn.cost === 800, `cena ISDN po inflaci ×2 = 800 (${isdn.cost})`);
}

console.log('\u2550\u2550\u2550 Test 5: řazení podle rychlosti \u2550\u2550\u2550');
{
  const opts = quickConnectOptions(CONN_T, 5, 1e9, null);
  let sorted = true;
  for (let i = 1; i < opts.length; i++) if (opts[i].maxBW < opts[i - 1].maxBW) sorted = false;
  ok(sorted, 'výstup je seřazený vzestupně podle maxBW');
  ok(opts[0].key === 'conn_isdn', 'první je nejpomalejší (ISDN)');
}

console.log('\u2550'.repeat(60));
if (fail === 0) { console.log(`\u2705 V\u0160ECHNY TESTY PRO\u0160LY: ${pass}/${pass}`); process.exit(0); }
else { console.log(`\u274c SELHALO: ${fail}, pro\u0161lo: ${pass}`); process.exit(1); }
