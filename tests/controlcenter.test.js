#!/usr/bin/env node
/**
 * controlcenter.test.js — řídící centrum (js/controlcenter.js)
 *
 * Co testuje:
 *   1. computePrestige — funkční síť = vysoká, výpadek/kongesce = nízká; meze 0..100
 *   2. smoothPrestige — plynulý posun k cíli
 *   3. prestigeGrowthMultiplier — 0.9..1.15
 *   4. qosCongestionFactor / qosMonthlyCost — profily
 *   5. addressingPlan — využití, headroom, meze
 */
'use strict';

const cc = require('../js/controlcenter.js');

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  \u2713 ' + m); } else { fail++; console.log('  \u2717 ' + m); } }
function approx(a, b, e) { return Math.abs(a - b) <= (e || 1e-9); }

console.log('\u2550\u2550\u2550 Test 1: computePrestige \u2550\u2550\u2550');
{
  const perfect = cc.computePrestige({ uptime01: 1, satisfaction01: 1, congestion01: 0, addrHeadroom01: 1, qosPrestige: 8 });
  ok(perfect === 100, `ideální síť → 100 (${perfect})`);
  const outage = cc.computePrestige({ uptime01: 0, satisfaction01: 0.5, congestion01: 0.5, addrHeadroom01: 0.5, qosPrestige: 0 });
  ok(outage < perfect, 'výpadek/kongesce snižují prestiž');
  const worst = cc.computePrestige({ uptime01: 0, satisfaction01: 0, congestion01: 1, addrHeadroom01: 0, qosPrestige: 0 });
  ok(worst === 0, `nejhorší stav → 0 (${worst})`);
  // meze
  let inRange = true;
  for (const u of [0, 1]) for (const s of [0, 0.5, 1]) for (const c of [0, 0.5, 1]) {
    const v = cc.computePrestige({ uptime01: u, satisfaction01: s, congestion01: c, addrHeadroom01: 0.5, qosPrestige: 4 });
    if (v < 0 || v > 100) inRange = false;
  }
  ok(inRange, 'vždy v mezích [0,100]');
  // uptime má největší váhu — výpadek bolí víc než plná kongesce
  const noUptime = cc.computePrestige({ uptime01: 0, satisfaction01: 1, congestion01: 0, addrHeadroom01: 1, qosPrestige: 8 });
  const fullCong = cc.computePrestige({ uptime01: 1, satisfaction01: 1, congestion01: 1, addrHeadroom01: 1, qosPrestige: 8 });
  ok(noUptime < fullCong, 'výpadek sráží prestiž víc než plná kongesce');
}

console.log('\u2550\u2550\u2550 Test 2: smoothPrestige \u2550\u2550\u2550');
{
  ok(cc.smoothPrestige(null, 80) === 80, 'z null → rovnou cíl');
  ok(cc.smoothPrestige(50, 100, 0.25) === 62.5, '50→100 rate 0.25 = 62.5');
  // konverguje
  let c = 0; for (let i = 0; i < 100; i++) c = cc.smoothPrestige(c, 90, 0.25);
  ok(approx(c, 90, 0.01), 'po mnoha krocích konverguje k cíli');
}

console.log('\u2550\u2550\u2550 Test 3: prestigeGrowthMultiplier \u2550\u2550\u2550');
ok(approx(cc.prestigeGrowthMultiplier(0), 0.9), 'prestiž 0 → 0.9');
ok(approx(cc.prestigeGrowthMultiplier(100), 1.15), 'prestiž 100 → 1.15');
ok(cc.prestigeGrowthMultiplier(50) > 1 && cc.prestigeGrowthMultiplier(50) < 1.05, 'prestiž 50 ~ neutrál');

console.log('\u2550\u2550\u2550 Test 4: QoS \u2550\u2550\u2550');
ok(cc.qosCongestionFactor('off') === 1, 'off → plná kongesce');
ok(cc.qosCongestionFactor('managed') < 1, 'managed tlumí kongesci');
ok(cc.qosCongestionFactor('strict') < cc.qosCongestionFactor('managed'), 'strict tlumí nejvíc');
ok(cc.qosMonthlyCost('off', 5) === 0, 'off zdarma');
ok(cc.qosMonthlyCost('managed', 4) === 6000, 'managed 4 DC = 6000');
ok(cc.qosMonthlyCost('strict', 3) === 12000, 'strict 3 DC = 12000');

console.log('\u2550\u2550\u2550 Test 5: addressingPlan \u2550\u2550\u2550');
{
  const p = cc.addressingPlan(256, 100, 10, 5);
  ok(p.total === 256 && p.used === 115, 'used = přípojky + věže + AP');
  ok(p.free === 141, 'free = total - used');
  ok(approx(p.util, 115 / 256), 'util = used/total');
  const full = cc.addressingPlan(100, 200, 0, 0);
  ok(full.util === 1 && full.free === 0, 'přeplněno → util 1, free 0');
  const none = cc.addressingPlan(0, 5, 0, 0);
  ok(none.util === 1 && none.headroom === 0, 'bez bloků a s potřebou → util 1, headroom 0');
  const empty = cc.addressingPlan(0, 0, 0, 0);
  ok(empty.util === 0, 'nic → util 0');
}

console.log('\u2550'.repeat(60));
if (fail === 0) { console.log(`\u2705 V\u0160ECHNY TESTY PRO\u0160LY: ${pass}/${pass}`); process.exit(0); }
else { console.log(`\u274c SELHALO: ${fail}, pro\u0161lo: ${pass}`); process.exit(1); }
