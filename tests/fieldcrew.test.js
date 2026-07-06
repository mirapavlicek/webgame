#!/usr/bin/env node
/**
 * fieldcrew.test.js — výjezdové čety opravující trasy (fieldCrewRemedy z js/incidents.js)
 *
 * Co testuje:
 *   1. Bez čet → 0
 *   2. Kabelové řezy (trasy) se opravují rychleji než ostatní incidenty
 *   3. Víc čet = víc oprav, ale se stropem (diminishing returns)
 *   4. Nezáporné hodnoty
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'js/incidents.js'), 'utf8');
const sandbox = {};
const proxy = new Proxy(sandbox, { has: () => true, get: (t, k) => (k in t ? t[k] : (k in globalThis ? globalThis[k] : undefined)) });
vm.runInContext(src, vm.createContext(proxy));
const f = sandbox.fieldCrewRemedy;

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  \u2713 ' + m); } else { fail++; console.log('  \u2717 ' + m); } }

console.log('\u2550\u2550\u2550 Test 0: existence \u2550\u2550\u2550');
ok(typeof f === 'function', 'fieldCrewRemedy je definovaná');

console.log('\u2550\u2550\u2550 Test 1: bez čet \u2550\u2550\u2550');
ok(f(0, true) === 0, '0 čet → 0');
ok(f(0, false) === 0, '0 čet (ne-kabel) → 0');
ok(f(-1, true) === 0, 'záporný počet → 0');

console.log('\u2550\u2550\u2550 Test 2: trasy vs. ostatní \u2550\u2550\u2550');
ok(f(1, true) > f(1, false), 'kabelový řez se opravuje rychleji než jiný incident');
ok(f(1, true) === 7, '1 četa na kabel = 7 bodů/den');
ok(f(1, false) === 2, '1 četa jinde = 2 body/den');

console.log('\u2550\u2550\u2550 Test 3: škálování a strop \u2550\u2550\u2550');
ok(f(2, true) > f(1, true), 'víc čet → víc oprav');
ok(f(3, true) === 21, '3 čety na kabel = 21');
ok(f(10, true) === 28, 'strop kabelových oprav = 28');
ok(f(10, false) === 8, 'strop ostatních = 8');

console.log('\u2550\u2550\u2550 Test 4: nezápornost \u2550\u2550\u2550');
{
  let good = true;
  for (let c = 0; c <= 20; c++) for (const cab of [true, false]) if (f(c, cab) < 0) good = false;
  ok(good, 'nikdy záporné');
}

console.log('\u2550'.repeat(60));
if (fail === 0) { console.log(`\u2705 V\u0160ECHNY TESTY PRO\u0160LY: ${pass}/${pass}`); process.exit(0); }
else { console.log(`\u274c SELHALO: ${fail}, pro\u0161lo: ${pass}`); process.exit(1); }
