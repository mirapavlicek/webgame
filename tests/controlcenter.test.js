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
 *   6. satBucketId / satBreakdownFromList — buckety štěstí, vážený průměr
 *   7. diagnoseSatIssues — diagnóza příčin nespokojenosti
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

console.log('\u2550\u2550\u2550 Test 6: buckety štěstí \u2550\u2550\u2550');
{
  ok(cc.satBucketId(85) === 'happy', '85 → šťastní');
  ok(cc.satBucketId(70) === 'happy', '70 → šťastní (hranice)');
  ok(cc.satBucketId(55) === 'content', '55 → spokojení');
  ok(cc.satBucketId(25) === 'unhappy', '25 → nespokojení');
  ok(cc.satBucketId(5) === 'critical', '5 → naštvaní');
  ok(cc.satBucketId(-10) === 'critical' && cc.satBucketId(150) === 'happy', 'ořez mimo meze');

  const bd = cc.satBreakdownFromList([
    { sat: 90, customers: 10 },
    { sat: 50, customers: 40 },
    { sat: 10, customers: 2 },
  ]);
  ok(bd.n === 3 && bd.customers === 52, 'počty budov a zákazníků');
  ok(bd.buckets.happy.blds === 1 && bd.buckets.happy.customers === 10, 'bucket šťastní');
  ok(bd.buckets.content.customers === 40 && bd.buckets.critical.customers === 2, 'buckety spokojení/naštvaní');
  ok(approx(bd.avg, 50, 0.01), `prostý průměr = 50 (${bd.avg.toFixed(1)})`);
  // vážený průměr: (90×11 + 50×41 + 10×3) / 55 = 3070/55 ≈ 55.8 — panelák táhne dolů méně než domek nahoru
  ok(approx(bd.wAvg, 3070 / 55, 0.01), `zákaznicky vážený průměr ≈ 55.8 (${bd.wAvg.toFixed(1)})`);
  const empty = cc.satBreakdownFromList([]);
  ok(empty.n === 0 && empty.avg === 0 && empty.wAvg === 0, 'prázdný seznam → nuly');
}

console.log('\u2550\u2550\u2550 Test 7: diagnóza nespokojenosti \u2550\u2550\u2550');
{
  ok(cc.diagnoseSatIssues({}).length === 0, 'bez příznaků → žádné problémy');
  const i1 = cc.diagnoseSatIssues({ outage: true, congRatio: 0.85 });
  ok(i1.length === 2 && i1[0].includes('výpadek') && i1[1].includes('85'), 'výpadek + kongesce 85 %');
  const i2 = cc.diagnoseSatIssues({ overRatio: 1.3 });
  ok(i2.length === 1 && i2[0].includes('dražší'), 'mírné předražení → „dražší tarif"');
  const i3 = cc.diagnoseSatIssues({ overRatio: 1.9 });
  ok(i3.length === 1 && i3[0].includes('silně předražený'), 'velké předražení → silnější hláška');
  const i4 = cc.diagnoseSatIssues({ wifi: true, noServices: true, weakDC: true });
  ok(i4.length === 3, 'wifi + bez služeb + slabé DC = 3 problémy');
  ok(cc.diagnoseSatIssues({ congRatio: 0.5, overRatio: 1.0 }).length === 0, 'kongesce 50 % a férová cena nevadí');
  // Ex varianta: každá příčina nese srozumitelný návod (fix)
  const ex = cc.diagnoseSatIssuesEx({ outage: true, congRatio: 0.9, overRatio: 1.3, wifi: true, noServices: true, weakDC: true });
  ok(ex.length === 6, 'Ex: všech 6 příčin');
  ok(ex.every(i => i.fix && i.fix.length > 30), 'Ex: každá příčina má návod k řešení');
  ok(ex.every(i => i.key && cc.SAT_ISSUE_DEFS[i.key]), 'Ex: klíče odpovídají katalogu');
  ok(cc.SAT_ISSUE_DEFS.weakdc.fix.includes('Server'), 'weakdc návod vysvětluje Server/NMS bonusy');
}

console.log('\u2550'.repeat(60));
if (fail === 0) { console.log(`\u2705 V\u0160ECHNY TESTY PRO\u0160LY: ${pass}/${pass}`); process.exit(0); }
else { console.log(`\u274c SELHALO: ${fail}, pro\u0161lo: ${pass}`); process.exit(1); }
