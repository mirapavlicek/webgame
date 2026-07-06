#!/usr/bin/env node
/**
 * lbflows.test.js — toky na polním load balanceru
 * (junctionFlowsFromSegs z js/capacity.js)
 *
 * Co testuje:
 *   1. Vrací jen směry, kde existuje kabelový segment
 *   2. Správné used/max/ratio a směrové štítky (S/J/V/Z)
 *   3. Degenerované vstupy
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const sandbox = {};
const proxy = new Proxy(sandbox, { has: () => true, get: (t, k) => (k in t ? t[k] : (k in globalThis ? globalThis[k] : undefined)) });
const ctx = vm.createContext(proxy);
// segKey je v map.js
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/map.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/capacity.js'), 'utf8'), ctx);
const flows = vm.runInContext('junctionFlowsFromSegs', ctx);
const segKey = vm.runInContext('segKey', ctx);

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  \u2713 ' + m); } else { fail++; console.log('  \u2717 ' + m); } }

// Uzel na (5,5): kabely na východ (used 450/1000) a na sever (used 900/1000)
const segs = {};
segs[segKey(5, 5, 6, 5)] = { used: 450, max: 1000, ratio: 0.45 };
segs[segKey(5, 5, 5, 4)] = { used: 900, max: 1000, ratio: 0.9 };

console.log('\u2550\u2550\u2550 Test 1: jen existující větve \u2550\u2550\u2550');
{
  const f = flows(5, 5, segs);
  ok(f.length === 2, `2 větve (bylo ${f.length})`);
  const dirs = f.map(x => x.dir).sort().join(',');
  ok(dirs === 'N,V', `směry N a V (${dirs})`);
}

console.log('\u2550\u2550\u2550 Test 2: hodnoty a štítky \u2550\u2550\u2550');
{
  const f = flows(5, 5, segs);
  const east = f.find(x => x.dir === 'V');
  const north = f.find(x => x.dir === 'N');
  ok(east.used === 450 && east.max === 1000, 'východ: 450/1000');
  ok(Math.abs(east.ratio - 0.45) < 1e-9, 'východ ratio 0.45');
  ok(east.label === 'východ' && east.dx === 1 && east.dy === 0, 'východ: label + vektor');
  ok(north.used === 900 && Math.abs(north.ratio - 0.9) < 1e-9, 'sever: 900/1000 (90 %)');
  ok(north.dx === 0 && north.dy === -1, 'sever: vektor (0,-1)');
}

console.log('\u2550\u2550\u2550 Test 3: degenerované \u2550\u2550\u2550');
{
  ok(flows(0, 0, {}).length === 0, 'bez segmentů → prázdné');
  ok(flows(0, 0, null).length === 0, 'null segs → prázdné');
  const zero = {};
  zero[segKey(1, 1, 2, 1)] = { used: 0, max: 0 };
  const f = flows(1, 1, zero);
  ok(f.length === 1 && f[0].ratio === 0, 'max 0 → ratio 0 (bez dělení nulou)');
}

console.log('\u2550'.repeat(60));
if (fail === 0) { console.log(`\u2705 V\u0160ECHNY TESTY PRO\u0160LY: ${pass}/${pass}`); process.exit(0); }
else { console.log(`\u274c SELHALO: ${fail}, pro\u0161lo: ${pass}`); process.exit(1); }
