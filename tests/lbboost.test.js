#!/usr/bin/env node
/**
 * lbboost.test.js — posílení polních load balancerů
 * (LB_SEG_BOOST / lbBoostedSegKeys z js/capacity.js)
 *
 * Co testuje:
 *   1. Aktivní junction_lb boostuje 4 přilehlé segmenty
 *   2. Pasivní přepínač a neaktivní LB neboostují
 *   3. Segment sousedící s 2 LB dostane boost jen jednou (Set)
 *   4. Konstanta boostu = 1.2 (+20 %)
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
const keys = vm.runInContext('lbBoostedSegKeys', ctx);
const BOOST = vm.runInContext('LB_SEG_BOOST', ctx);
const segKey = vm.runInContext('segKey', ctx);

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  \u2713 ' + m); } else { fail++; console.log('  \u2717 ' + m); } }

console.log('\u2550\u2550\u2550 Test 1: aktivní LB → 4 segmenty \u2550\u2550\u2550');
{
  const s = keys([{ x: 5, y: 5, type: 'junction_lb', active: true }]);
  ok(s.size === 4, `4 přilehlé segmenty (${s.size})`);
  ok(s.has(segKey(5, 5, 6, 5)) && s.has(segKey(5, 5, 4, 5)), 'V + Z segmenty');
  ok(s.has(segKey(5, 5, 5, 6)) && s.has(segKey(5, 5, 5, 4)), 'J + S segmenty');
  ok(!s.has(segKey(6, 5, 7, 5)), 'vzdálenější segment ne');
}

console.log('\u2550\u2550\u2550 Test 2: pasivní / neaktivní neboostují \u2550\u2550\u2550');
ok(keys([{ x: 5, y: 5, type: 'junction_switch', active: true }]).size === 0, 'pasivní přepínač → 0');
ok(keys([{ x: 5, y: 5, type: 'junction_lb', active: false }]).size === 0, 'pozastavený LB → 0');
ok(keys([]).size === 0, 'bez junctionů → 0');
ok(keys(null).size === 0, 'null → 0');

console.log('\u2550\u2550\u2550 Test 3: sousedící LB — boost jen jednou \u2550\u2550\u2550');
{
  // dva LB vedle sebe: segment mezi nimi je přilehlý oběma → v Setu jen jednou
  const s = keys([
    { x: 5, y: 5, type: 'junction_lb', active: true },
    { x: 6, y: 5, type: 'junction_lb', active: true },
  ]);
  ok(s.size === 7, `2 LB vedle sebe → 7 unikátních segmentů (4+4−1 sdílený), bylo ${s.size}`);
  ok(s.has(segKey(5, 5, 6, 5)), 'sdílený segment v Setu (jednou)');
}

console.log('\u2550\u2550\u2550 Test 4: velikost boostu \u2550\u2550\u2550');
ok(Math.abs(BOOST - 1.2) < 1e-9, 'LB_SEG_BOOST = 1.2 (+20 %)');
ok(Math.round(1000 * BOOST) === 1200, '1 Gbps segment → efektivně 1.2 Gbps');

console.log('\u2550'.repeat(60));
if (fail === 0) { console.log(`\u2705 V\u0160ECHNY TESTY PRO\u0160LY: ${pass}/${pass}`); process.exit(0); }
else { console.log(`\u274c SELHALO: ${fail}, pro\u0161lo: ${pass}`); process.exit(1); }
