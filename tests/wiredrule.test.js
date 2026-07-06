#!/usr/bin/env node
/**
 * wiredrule.test.js — fyzická vrstva přípojek
 * (isWirelessConnType / connInstallRequirement z js/actions.js)
 *
 * Pravidlo: na pevnou linku se smí napojit jen budova, u které vede kabel;
 * klient na 5G/WiFi se bez kabelu převést nedá. WiFi vyžaduje AP v dosahu,
 * mobilní typy přiděluje jen vysílač.
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
const isWL = sandbox.isWirelessConnType;
const req = sandbox.connInstallRequirement;

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  \u2713 ' + m); } else { fail++; console.log('  \u2717 ' + m); } }

console.log('\u2550\u2550\u2550 Test 1: isWirelessConnType \u2550\u2550\u2550');
ok(isWL('conn_wifi') === true, 'WiFi je bezdrát');
ok(isWL('conn_lte') === true, 'LTE je bezdrát');
ok(isWL('conn_lte_a') === true, 'LTE-A je bezdrát');
ok(isWL('conn_5g') === true, '5G je bezdrát');
ok(isWL('conn_5g_mmw') === true, '5G mmWave je bezdrát');
ok(isWL('conn_adsl') === false, 'ADSL je pevná');
ok(isWL('conn_fiber1g') === false, 'optika je pevná');
ok(isWL(null) === false, 'null → ne');

console.log('\u2550\u2550\u2550 Test 2: connInstallRequirement \u2550\u2550\u2550');
ok(req('conn_isdn') === 'cable', 'ISDN vyžaduje kabel');
ok(req('conn_adsl') === 'cable', 'ADSL vyžaduje kabel');
ok(req('conn_fiber100g') === 'cable', '100G optika vyžaduje kabel');
ok(req('conn_wifi') === 'wifi_ap', 'WiFi vyžaduje AP v dosahu');
ok(req('conn_lte') === 'tower', 'LTE jen přes vysílač (ručně nelze)');
ok(req('conn_5g') === 'tower', '5G jen přes vysílač');
ok(req('conn_5g_mmw') === 'tower', '5G mmWave jen přes vysílač');

console.log('\u2550\u2550\u2550 Test 3: klíčový scénář — 5G klient na pevnou jen s kabelem \u2550\u2550\u2550');
{
  // Budova na conn_5g chce upgrade na optiku → požadavek 'cable' znamená,
  // že connectBld musí najít kabelovou cestu (findDC) — bez ní se odmítne.
  ok(isWL('conn_5g') && req('conn_fiber1g') === 'cable',
     '5G→optika: nový typ vyžaduje fyzický kabel u budovy');
  ok(isWL('conn_wifi') && req('conn_vdsl') === 'cable',
     'WiFi→VDSL: totéž — bez kabelu nelze');
}

console.log('\u2550'.repeat(60));
if (fail === 0) { console.log(`\u2705 V\u0160ECHNY TESTY PRO\u0160LY: ${pass}/${pass}`); process.exit(0); }
else { console.log(`\u274c SELHALO: ${fail}, pro\u0161lo: ${pass}`); process.exit(1); }
