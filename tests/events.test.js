#!/usr/bin/env node
/**
 * events.test.js — ověření váženého výběru událostí (weightedPick z js/events.js)
 *
 * Co testuje:
 *   1. Funkce existuje
 *   2. Nulové/prázdné váhy → -1
 *   3. Deterministický výběr podle kumulativních vah a r ∈ [0,1)
 *   4. Nulová váha položku přeskočí
 *   5. Statisticky výběr respektuje poměr vah
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'js/events.js'), 'utf8');

const sandbox = {};
const proxy = new Proxy(sandbox, {
  has: () => true,
  get: (t, k) => (k in t ? t[k] : (k in globalThis ? globalThis[k] : undefined)),
});
vm.runInContext(src, vm.createContext(proxy));
const weightedPick = sandbox.weightedPick;

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log('  \u2713 ' + msg); }
  else { fail++; console.log('  \u2717 ' + msg); }
}

console.log('\u2550\u2550\u2550 Test 0: existence \u2550\u2550\u2550');
ok(typeof weightedPick === 'function', 'weightedPick je definovaná');

console.log('\u2550\u2550\u2550 Test 1: degenerované vstupy \u2550\u2550\u2550');
ok(weightedPick([]) === -1, 'prázdné pole → -1');
ok(weightedPick([0, 0, 0]) === -1, 'samé nuly → -1');
ok(weightedPick([0, -5, 0]) === -1, 'záporné/nulové → -1');

console.log('\u2550\u2550\u2550 Test 2: deterministický výběr \u2550\u2550\u2550');
{
  // váhy [1,1,2], total=4. r=0→idx0, r=0.25→idx1, r=0.5→idx2, r=0.99→idx2
  const w = [1, 1, 2];
  ok(weightedPick(w, 0) === 0, 'r=0 → index 0');
  ok(weightedPick(w, 0.25 + 1e-6) === 1, 'r=0.25+ → index 1');
  ok(weightedPick(w, 0.5 + 1e-6) === 2, 'r=0.5+ → index 2');
  ok(weightedPick(w, 0.999) === 2, 'r→1 → poslední index');
}

console.log('\u2550\u2550\u2550 Test 3: nulová váha přeskočena \u2550\u2550\u2550');
{
  const w = [0, 1, 0];
  let always1 = true;
  for (let r = 0; r < 1; r += 0.05) if (weightedPick(w, r) !== 1) always1 = false;
  ok(always1, 'jediná nenulová položka se vždy vybere');
}

console.log('\u2550\u2550\u2550 Test 4: statistický poměr \u2550\u2550\u2550');
{
  const w = [1, 3]; // očekáváme ~25 % / 75 %
  let c0 = 0, c1 = 0, N = 40000;
  for (let i = 0; i < N; i++) { const idx = weightedPick(w); if (idx === 0) c0++; else c1++; }
  const ratio = c1 / N;
  ok(ratio > 0.70 && ratio < 0.80, `index1 ≈ 75 % (skut. ${(ratio * 100).toFixed(1)} %)`);
}

console.log('\u2550'.repeat(60));
if (fail === 0) { console.log(`\u2705 V\u0160ECHNY TESTY PRO\u0160LY: ${pass}/${pass}`); process.exit(0); }
else { console.log(`\u274c SELHALO: ${fail}, pro\u0161lo: ${pass}`); process.exit(1); }
