#!/usr/bin/env node
/**
 * objectives.test.js — ověření logiky cílů/výzev (js/objectives.js)
 *
 * Co testuje:
 *   1. objectiveProgress — správné metriky pro různé typy
 *   2. objectiveDone — hranice splnění
 *   3. generateObjective — platná instance, vyhne se aktivním typům
 */
'use strict';

// Globály, na které se modul odkazuje (v prohlížeči jsou globální).
globalThis.MAP = 2;
globalThis.fmtKc = (n) => Math.round(n) + ' Kč';
globalThis.TECHS = [{ name: 'ADSL' }, { name: 'VDSL' }, { name: 'FTTH' }, { name: 'XGS' }, { name: '25G' }, { name: '50G' }];

const obj = require('../js/objectives.js');

// Mock hry: 2×2 mapa, 2 připojené budovy (1 nemocnice), 50 zákazníků atd.
function mockG() {
  return {
    stats: { cust: 50, inc: 200000, exp: 120000 },
    dcs: [{}, {}],
    towers: [{}, {}, {}],
    tech: 3,
    cash: 500000,
    objectives: [],
    map: [
      [{ bld: { type: 'house', connected: true } }, { bld: { type: 'hospital', connected: true } }],
      [{ bld: { type: 'shop', connected: false } }, { bld: null }],
    ],
  };
}

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  \u2713 ' + m); } else { fail++; console.log('  \u2717 ' + m); } }

const G = mockG();

console.log('\u2550\u2550\u2550 Test 1: objectiveProgress \u2550\u2550\u2550');
ok(obj.objectiveProgress({ type: 'customers' }, G) === 50, 'customers → 50');
ok(obj.objectiveProgress({ type: 'dcs' }, G) === 2, 'dcs → 2');
ok(obj.objectiveProgress({ type: 'towers' }, G) === 3, 'towers → 3');
ok(obj.objectiveProgress({ type: 'tech' }, G) === 3, 'tech → 3');
ok(obj.objectiveProgress({ type: 'cash' }, G) === 500000, 'cash → 500000');
ok(obj.objectiveProgress({ type: 'profit' }, G) === 80000, 'profit → inc-exp = 80000');
ok(obj.objectiveProgress({ type: 'connected' }, G) === 2, 'connected → 2 budovy');
ok(obj.objectiveProgress({ type: 'coverType', building: 'hospital' }, G) === 1, 'coverType hospital → 1');

console.log('\u2550\u2550\u2550 Test 2: objectiveDone \u2550\u2550\u2550');
ok(obj.objectiveDone({ type: 'customers', target: 50 }, G) === true, 'prog==target → splněno');
ok(obj.objectiveDone({ type: 'customers', target: 51 }, G) === false, 'prog<target → nesplněno');
ok(obj.objectiveDone({ type: 'customers', target: 10 }, G) === true, 'prog>target → splněno');

console.log('\u2550\u2550\u2550 Test 3: generateObjective \u2550\u2550\u2550');
{
  let okAll = true, hasKey = true, posReward = true;
  for (let i = 0; i < 200; i++) {
    const o = obj.generateObjective(G, Math.random, new Set());
    if (!o || typeof o.target !== 'number' || o.target <= 0) okAll = false;
    if (!o.key || typeof o.key !== 'string') hasKey = false;
    if (!(o.reward > 0)) posReward = false;
  }
  ok(okAll, 'vždy vrací instanci s kladným cílem');
  ok(hasKey, 'instance má key');
  ok(posReward, 'instance má kladnou odměnu');
  // vyhne se aktivním typům
  const active = new Set(obj.OBJ_TEMPLATES.slice(0, obj.OBJ_TEMPLATES.length - 1).map(t => t.type + (t.building || '')));
  const o2 = obj.generateObjective(G, Math.random, active);
  const last = obj.OBJ_TEMPLATES[obj.OBJ_TEMPLATES.length - 1];
  ok(o2.key === (last.type + (last.building || '')), 'při obsazených typech vybere zbývající');
}

console.log('\u2550'.repeat(60));
if (fail === 0) { console.log(`\u2705 V\u0160ECHNY TESTY PRO\u0160LY: ${pass}/${pass}`); process.exit(0); }
else { console.log(`\u274c SELHALO: ${fail}, pro\u0161lo: ${pass}`); process.exit(1); }
