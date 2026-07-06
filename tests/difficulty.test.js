#!/usr/bin/env node
/**
 * difficulty.test.js — obtížnost (difficultyMods z js/difficulty.js)
 *
 * Co testuje:
 *   1. Normál = neutrální (1,1,1)
 *   2. Heavy = hůř zákazníci, víc poruch, dražší provoz
 *   3. Hardcore = 1,33× odchylka Heavy od normálu
 *   4. Neznámá úroveň → normál
 */
'use strict';

const d = require('../js/difficulty.js');
const mods = d.difficultyMods;

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  \u2713 ' + m); } else { fail++; console.log('  \u2717 ' + m); } }
function approx(a, b) { return Math.abs(a - b) < 1e-9; }

console.log('\u2550\u2550\u2550 Test 1: normál \u2550\u2550\u2550');
{
  const n = mods('normal');
  ok(n.growth === 1 && n.incident === 1 && n.cost === 1, 'normál = (1,1,1)');
}

console.log('\u2550\u2550\u2550 Test 2: heavy \u2550\u2550\u2550');
{
  const h = mods('heavy');
  ok(h.growth < 1, `growth < 1 (${h.growth})`);
  ok(h.incident > 1, `incident > 1 (${h.incident})`);
  ok(h.cost > 1, `cost > 1 (${h.cost})`);
  ok(approx(h.growth, 0.65), 'heavy growth = 0.65');
  ok(approx(h.incident, 1.6), 'heavy incident = 1.6');
  ok(approx(h.cost, 1.5), 'heavy cost = 1.5');
}

console.log('\u2550\u2550\u2550 Test 3: hardcore = 1,33× heavy \u2550\u2550\u2550');
{
  const h = mods('heavy'), hc = mods('hardcore'), k = 1.33;
  ok(approx(hc.growth, 1 - (1 - h.growth) * k), `growth = 1-(1-heavy)*1.33 (${hc.growth.toFixed(4)})`);
  ok(approx(hc.incident, 1 + (h.incident - 1) * k), `incident = 1+(heavy-1)*1.33 (${hc.incident.toFixed(4)})`);
  ok(approx(hc.cost, 1 + (h.cost - 1) * k), `cost = 1+(heavy-1)*1.33 (${hc.cost.toFixed(4)})`);
  // hardcore je tvrdší než heavy ve všech osách
  ok(hc.growth < h.growth, 'hardcore hůř zákazníci než heavy');
  ok(hc.incident > h.incident, 'hardcore víc poruch než heavy');
  ok(hc.cost > h.cost, 'hardcore dražší než heavy');
}

console.log('\u2550\u2550\u2550 Test 4: neznámá úroveň \u2550\u2550\u2550');
{
  const u = mods('nesmysl');
  ok(u.growth === 1 && u.incident === 1 && u.cost === 1, 'neznámé → normál');
}

console.log('\u2550'.repeat(60));
if (fail === 0) { console.log(`\u2705 V\u0160ECHNY TESTY PRO\u0160LY: ${pass}/${pass}`); process.exit(0); }
else { console.log(`\u274c SELHALO: ${fail}, pro\u0161lo: ${pass}`); process.exit(1); }
