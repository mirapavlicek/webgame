#!/usr/bin/env node
/**
 * peakdemand.test.js — ověření mechaniky denní špičky (peakDemandMultiplier)
 * z js/capacity.js
 *
 * Spouští se: `node tests/peakdemand.test.js` (z rootu repa)
 *
 * Co testuje:
 *   1. Funkce existuje
 *   2. Večerní prime-time (≈20-21 h) má výrazně zvýšenou poptávku
 *   3. Hluboká noc (≈4 h) má sníženou poptávku (< 1.0)
 *   4. Poledne je blízko neutrálu
 *   5. Výstup je vždy v mezích [0.7, 1.45]
 *   6. Hodina se cyklí (24 ≡ 0)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'js/capacity.js'), 'utf8');

const sandbox = {};
const proxy = new Proxy(sandbox, {
  has: () => true,
  get: (t, k) => (k in t ? t[k] : (k in globalThis ? globalThis[k] : undefined)),
});
const context = vm.createContext(proxy);
vm.runInContext(src, context);
const peak = sandbox.peakDemandMultiplier;

const MIN = 0.7, MAX = 1.45;
let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log('  \u2713 ' + msg); }
  else { fail++; console.log('  \u2717 ' + msg); }
}

console.log('\u2550\u2550\u2550 Test 0: funkce existuje \u2550\u2550\u2550');
ok(typeof peak === 'function', 'peakDemandMultiplier je definovaná');
ok(typeof sandbox.currentPeakDemand === 'function', 'currentPeakDemand je definovaná');

console.log('\u2550\u2550\u2550 Test 1: večerní špička \u2550\u2550\u2550');
{
  const e = peak(20.5);
  ok(e > 1.3, `ve 20:30 je poptávka výrazně zvýšená (${e.toFixed(3)})`);
  ok(e >= peak(14), 'večer >= poledne');
}

console.log('\u2550\u2550\u2550 Test 2: noční útlum \u2550\u2550\u2550');
{
  const n = peak(4);
  ok(n < 1.0, `ve 4:00 je poptávka snížená (${n.toFixed(3)})`);
  ok(n < peak(20.5), 'noc < večer');
}

console.log('\u2550\u2550\u2550 Test 3: poledne blízko neutrálu \u2550\u2550\u2550');
{
  const m = peak(14);
  ok(m > 0.9 && m < 1.2, `poledne je zhruba neutrální (${m.toFixed(3)})`);
}

console.log('\u2550\u2550\u2550 Test 4: meze \u2550\u2550\u2550');
{
  let inRange = true, min = 99, max = -99;
  for (let h = 0; h <= 48; h += 0.25) {
    const v = peak(h);
    if (v < MIN - 1e-9 || v > MAX + 1e-9) inRange = false;
    if (v < min) min = v; if (v > max) max = v;
  }
  ok(inRange, `vždy v mezích [${MIN}, ${MAX}] (skut. min=${min.toFixed(3)}, max=${max.toFixed(3)})`);
}

console.log('\u2550\u2550\u2550 Test 5: cyklení hodiny \u2550\u2550\u2550');
{
  ok(Math.abs(peak(0) - peak(24)) < 1e-9, '0 h ≡ 24 h');
  ok(Math.abs(peak(20.5) - peak(20.5 + 24)) < 1e-9, '20.5 h ≡ 44.5 h');
  ok(Math.abs(peak(-4) - peak(20)) < 1e-9, '-4 h ≡ 20 h (záporné se zabalí)');
}

console.log('\u2550'.repeat(60));
if (fail === 0) { console.log(`\u2705 V\u0160ECHNY TESTY PRO\u0160LY: ${pass}/${pass}`); process.exit(0); }
else { console.log(`\u274c SELHALO: ${fail}, pro\u0161lo: ${pass}`); process.exit(1); }
