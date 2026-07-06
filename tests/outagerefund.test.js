#!/usr/bin/env node
/**
 * outagerefund.test.js — refundace tarifu za výpadek (outageRefundRate z js/events.js)
 *
 * Model: výpadek NEVYNuluje příjem; místo toho se podle délky výpadku zákazníci
 * mohou (a nemusí) dožadovat vrácení části tarifu.
 *
 * Co testuje:
 *   1. Krátký výpadek (< 1 den) → 0
 *   2. Pravděpodobnost dožadování roste s délkou (statisticky)
 *   3. Když se dožadují, výše roste s délkou; UPS ji zmírní
 *   4. Strop 60 %; nikdy záporné
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'js/events.js'), 'utf8');
const sandbox = {};
const proxy = new Proxy(sandbox, { has: () => true, get: (t, k) => (k in t ? t[k] : (k in globalThis ? globalThis[k] : undefined)) });
vm.runInContext(src, vm.createContext(proxy));
const rate = sandbox.outageRefundRate;

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  \u2713 ' + m); } else { fail++; console.log('  \u2717 ' + m); } }

console.log('\u2550\u2550\u2550 Test 0: existence \u2550\u2550\u2550');
ok(typeof rate === 'function', 'outageRefundRate je definovaná');

console.log('\u2550\u2550\u2550 Test 1: krátký výpadek \u2550\u2550\u2550');
ok(rate(0, false, () => 0) === 0, '0 dní → 0');
ok(rate(0.5, false, () => 0) === 0, '< 1 den → 0 (tolerováno)');

console.log('\u2550\u2550\u2550 Test 2: pravděpodobnost dožadování roste s délkou \u2550\u2550\u2550');
{
  function demandRatio(days, N) {
    let c = 0;
    for (let i = 0; i < N; i++) if (rate(days, false, Math.random) > 0) c++;
    return c / N;
  }
  const p1 = demandRatio(1, 20000);
  const p3 = demandRatio(3, 20000);
  const p7 = demandRatio(7, 20000);
  ok(p1 < p3 && p3 < p7, `roste: 1d ${(p1*100).toFixed(0)}% < 3d ${(p3*100).toFixed(0)}% < 7d ${(p7*100).toFixed(0)}%`);
  ok(p7 > 0.8, `7 dní → skoro vždy se dožadují (${(p7*100).toFixed(0)}%)`);
}

console.log('\u2550\u2550\u2550 Test 3: výše refundace \u2550\u2550\u2550');
{
  // s rnd=0 se vždy dožadují (demandProb > 0) → dostaneme kladnou sazbu
  const r3 = rate(3, false, () => 0);
  const r10 = rate(10, false, () => 0);
  ok(r3 > 0, `3 dny → kladná sazba (${r3.toFixed(3)})`);
  ok(r10 > r3, `delší výpadek → vyšší sazba (${r10.toFixed(3)} > ${r3.toFixed(3)})`);
  // UPS zmírní
  const rNo = rate(6, false, () => 0);
  const rUps = rate(6, true, () => 0);
  ok(rUps < rNo, `UPS zmírní refundaci (${rUps.toFixed(3)} < ${rNo.toFixed(3)})`);
}

console.log('\u2550\u2550\u2550 Test 4: meze \u2550\u2550\u2550');
{
  let okRange = true;
  for (const d of [1, 2, 5, 10, 20, 30, 60]) for (const ups of [true, false]) {
    const v = rate(d, ups, () => 0);
    if (v < 0 || v > 0.6 + 1e-9) okRange = false;
  }
  ok(okRange, 'sazba vždy v mezích [0, 0.6]');
  ok(rate(30, false, () => 0) <= 0.6, 'i měsíční výpadek respektuje strop 60 %');
}

console.log('\u2550'.repeat(60));
if (fail === 0) { console.log(`\u2705 V\u0160ECHNY TESTY PRO\u0160LY: ${pass}/${pass}`); process.exit(0); }
else { console.log(`\u274c SELHALO: ${fail}, pro\u0161lo: ${pass}`); process.exit(1); }
