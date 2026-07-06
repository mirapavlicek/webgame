#!/usr/bin/env node
/**
 * bgpoverflow.test.js — BGP overflow takeover
 * (bgpOverflowTakeover z js/capacity.js)
 *
 * Pravidlo: když je propojené DC PŘES kapacitu, peer s volnou kapacitou
 * automaticky převezme nadbytek — i nad rámec manuální alokace, do volné
 * kapacity dárce a fyzického zbytku peering linky (s 5% headroomem).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const sandbox = {};
const proxy = new Proxy(sandbox, { has: () => true, get: (t, k) => (k in t ? t[k] : (k in globalThis ? globalThis[k] : undefined)) });
const ctx = vm.createContext(proxy);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/map.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/capacity.js'), 'utf8'), ctx);
const take = vm.runInContext('bgpOverflowTakeover', ctx);

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  \u2713 ' + m); } else { fail++; console.log('  \u2717 ' + m); } }

console.log('\u2550\u2550\u2550 Test 1: bez přetečení nic \u2550\u2550\u2550');
ok(take(0, 5000, 5000, 0.05) === 0, 'deficit 0 → 0');
ok(take(-500, 5000, 5000, 0.05) === 0, 'záporný deficit → 0');
ok(take(null, 5000, 5000, 0.05) === 0, 'null → 0');

console.log('\u2550\u2550\u2550 Test 2: převzetí s headroomem \u2550\u2550\u2550');
ok(take(1000, 10000, 10000, 0.05) === 1050, 'deficit 1000 → 1050 (+5 % headroom)');
ok(take(1000, 10000, 10000, 0) === 1000, 'bez headroomu → přesně deficit');

console.log('\u2550\u2550\u2550 Test 3: limity dárce a linky \u2550\u2550\u2550');
ok(take(1000, 400, 10000, 0.05) === 400, 'dárce má jen 400 volných → 400');
ok(take(1000, 10000, 300, 0.05) === 300, 'linka má jen 300 zbylé → 300');
ok(take(1000, 0, 10000, 0.05) === 0, 'dárce bez volné kapacity → 0');
ok(take(1000, 10000, 0, 0.05) === 0, 'plně vytížená linka → 0');
ok(take(1000, -50, 10000, 0.05) === 0, 'záporné volno dárce → 0 (guard)');

console.log('\u2550\u2550\u2550 Test 4: velké přetečení \u2550\u2550\u2550');
{
  // DC přeteklé o 40 Gbps, peer má 100 Gbps volných, linka 1T → převezme 42 Gbps
  const v = take(40000, 100000, 1000000, 0.05);
  ok(v === 42000, `40 Gbps deficit → 42 Gbps převzato (${v})`);
}

console.log('\u2550'.repeat(60));
if (fail === 0) { console.log(`\u2705 V\u0160ECHNY TESTY PRO\u0160LY: ${pass}/${pass}`); process.exit(0); }
else { console.log(`\u274c SELHALO: ${fail}, pro\u0161lo: ${pass}`); process.exit(1); }
