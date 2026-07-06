#!/usr/bin/env node
/**
 * workload.test.js — zátěž štábu (staffWorkloadUnits z js/morale.js)
 *
 * Motivace: 10 techniků na 2000 přípojek MUSÍ být pohodlně dost (dřív to hlásilo
 * přetížení, což byl nesmysl).
 *
 * Co testuje:
 *   1. Technik: 2000 přípojek / 10 techniků → load/hlava výrazně pod prahem
 *   2. Škálování s přípojkami/kabely; DC a HW jen drobný příspěvek
 *   3. Ostatní role (sales/support/noc/dev) dávají rozumné jednotky
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'js/morale.js'), 'utf8');
const sandbox = {};
const proxy = new Proxy(sandbox, { has: () => true, get: (t, k) => (k in t ? t[k] : (k in globalThis ? globalThis[k] : undefined)) });
vm.runInContext(src, vm.createContext(proxy));
const units = sandbox.staffWorkloadUnits;

const THRESHOLD = 1.2; // base práh z getMoraleThreshold

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  \u2713 ' + m); } else { fail++; console.log('  \u2717 ' + m); } }

console.log('\u2550\u2550\u2550 Test 0: existence \u2550\u2550\u2550');
ok(typeof units === 'function', 'staffWorkloadUnits je definovaná');

console.log('\u2550\u2550\u2550 Test 1: 10 techniků na 2000 přípojek \u2550\u2550\u2550');
{
  const m = { connections: 2000, cables: 1500, dcs: 5, eqTotal: 60 };
  const w = units('tech', m);
  const perHead = w / 10;
  ok(perHead < THRESHOLD, `load/hlava (${perHead.toFixed(2)}) je pod prahem ${THRESHOLD}`);
  ok(perHead < THRESHOLD * 0.8, `dokonce v pohodlné zóně (< ${THRESHOLD * 0.8})`);
}

console.log('\u2550\u2550\u2550 Test 2: rozumný počet techniků pro velkou síť \u2550\u2550\u2550');
{
  // 2000 přípojek: kolik techniků potřeba, aby load/hlava <= threshold?
  const m = { connections: 2000, cables: 0, dcs: 0, eqTotal: 0 };
  const w = units('tech', m); // = 2000/800 = 2.5 jednotky
  ok(Math.abs(w - 2.5) < 1e-9, '2000 přípojek = 2.5 pracovní jednotky');
  const techneeded = Math.ceil(w / THRESHOLD);
  ok(techneeded <= 3, `stačí ≤3 technici na 2000 přípojek (potřeba ${techneeded})`);
}

console.log('\u2550\u2550\u2550 Test 3: příspěvky složek \u2550\u2550\u2550');
{
  ok(units('tech', { connections: 800 }) === 1, '800 přípojek = 1 jednotka');
  ok(units('tech', { cables: 800 }) === 1, '800 kabelů = 1 jednotka');
  ok(units('tech', { dcs: 2 }) === 1, '2 DC = 1 jednotka');
  ok(units('tech', { eqTotal: 100 }) === 1, '100 HW kusů = 1 jednotka');
  // HW má malý dopad — 12 kusů výrazně méně než dřív (kde 1 kus = 1 jednotka)
  ok(units('tech', { eqTotal: 12 }) < 0.3, '12 HW kusů = malý příspěvek');
}

console.log('\u2550\u2550\u2550 Test 4: ostatní role \u2550\u2550\u2550');
{
  ok(units('sales', { customers: 400 }) === 1, 'sales: 400 zákazníků = 1');
  ok(units('support', { customers: 300 }) === 1, 'support: 300 zákazníků = 1');
  ok(units('noc', { dcs: 3, incidents: 2 }) === 7, 'noc: 3 DC + 2 incidenty = 7');
  ok(units('dev', { services: 2, cloud: 1 }) === 4, 'dev: 2 služby + 1 cloud = 4');
}

console.log('\u2550'.repeat(60));
if (fail === 0) { console.log(`\u2705 V\u0160ECHNY TESTY PRO\u0160LY: ${pass}/${pass}`); process.exit(0); }
else { console.log(`\u274c SELHALO: ${fail}, pro\u0161lo: ${pass}`); process.exit(1); }
