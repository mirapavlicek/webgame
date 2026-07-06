#!/usr/bin/env node
/**
 * cloudadmin.test.js — správce cloudu + oprava cloudové ekonomiky
 * (cloudAdminsNeeded / cloudOpsFormula z js/actions.js)
 *
 * Motivace: cloud měl 20,9 M příjmů a 17 k nákladů (marže 100 %) — náklady
 * škálovaly jen s instancemi, ne s velikostí byznysu.
 *
 * Co testuje:
 *   1. cloudAdminsNeeded — 1 správce na ~250 zákazníků
 *   2. cloudOpsFormula — náklady škálují s příjmy (COGS ~32 %), marže ≤ ~84 %
 *   3. Penalizace při poddimenzování, sleva za automatizaci s capem
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'js/actions.js'), 'utf8');
const sandbox = {};
const proxy = new Proxy(sandbox, { has: () => true, get: (t, k) => (k in t ? t[k] : (k in globalThis ? globalThis[k] : undefined)) });
vm.runInContext(src, vm.createContext(proxy));
const needed = sandbox.cloudAdminsNeeded;
const ops = sandbox.cloudOpsFormula;

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  \u2713 ' + m); } else { fail++; console.log('  \u2717 ' + m); } }

console.log('\u2550\u2550\u2550 Test 1: cloudAdminsNeeded \u2550\u2550\u2550');
ok(needed(0) === 0, '0 zákazníků → 0 správců');
ok(needed(1) === 1, '1 zákazník → 1 správce');
ok(needed(250) === 1, '250 → 1');
ok(needed(251) === 2, '251 → 2');
ok(needed(1000) === 4, '1000 → 4');
ok(needed(null) === 0, 'null → 0');

console.log('\u2550\u2550\u2550 Test 2: náklady škálují s příjmy \u2550\u2550\u2550');
{
  // Scénář ze screenshotu: 20,9 M příjmů, minimum instancí
  const rev = 20892755;
  const cost = ops(17151, rev, 0, 1, 1);
  ok(cost > rev * 0.30, `náklady ≥ 30 % příjmů (${cost} vs. rev ${rev})`);
  const margin = (rev - cost) / rev;
  ok(margin < 0.70, `marže < 70 % bez automatizace (${(margin * 100).toFixed(1)} %)`);
  // I s maximální slevou (0.5) marže nepřesáhne ~84 %
  const costMax = ops(0, rev, 0.5, 1, 1);
  ok((rev - costMax) / rev <= 0.84 + 1e-9, `marže s max automatizací ≤ 84 % (${(((rev - costMax) / rev) * 100).toFixed(1)} %)`);
}

console.log('\u2550\u2550\u2550 Test 3: penalizace a sleva \u2550\u2550\u2550');
{
  const base = ops(1000, 100000, 0, 1, 1);
  ok(ops(1000, 100000, 0, 1.35, 1) > base, 'poddimenzování zdraží provoz (×1.35)');
  ok(ops(1000, 100000, 0.3, 1, 1) < base, 'automatizace zlevní');
  ok(ops(1000, 100000, 0.9, 1, 1) === ops(1000, 100000, 0.5, 1, 1), 'sleva capped na 0.5');
  ok(ops(1000, 100000, 0, 0.5, 1) === base, 'understaffMult < 1 se bere jako 1');
  ok(ops(0, 0, 0, 1, 1) === 0, 'nic → 0');
  // inflace zvedá jen fixní část instancí
  ok(ops(1000, 0, 0, 1, 2) === 2000, 'inflace ×2 na instanční bázi');
}

console.log('\u2550'.repeat(60));
if (fail === 0) { console.log(`\u2705 V\u0160ECHNY TESTY PRO\u0160LY: ${pass}/${pass}`); process.exit(0); }
else { console.log(`\u274c SELHALO: ${fail}, pro\u0161lo: ${pass}`); process.exit(1); }
